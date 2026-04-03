import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  CreateOrderDto,
  CreateProductDto,
  OrderQueryDto,
  RestockProductDto,
  UpdateOrderStatusDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBootstrapData(userId: string) {
    const [categories, products, orders, restockQueue, dashboard, activities] =
      await Promise.all([
        this.getCategories(userId),
        this.getProducts(userId),
        this.getOrders(userId, {}),
        this.getRestockQueue(userId),
        this.getDashboard(userId),
        this.getActivity(userId),
      ]);

    return { categories, products, orders, restockQueue, dashboard, activities };
  }

  async createCategory(
    dto: CreateCategoryDto,
    ownerId: string,
    actorName: string,
    actorId?: string,
  ) {
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        ownerId,
        name: {
          equals: dto.name.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      throw new ConflictException('You already have a category with this name.');
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        ownerId,
      },
    });

    await this.logActivity(
      actorName,
      'CATEGORY_CREATED',
      'category',
      category.id,
      `Category "${category.name}" created`,
      actorId,
    );

    return category;
  }

  getCategories(userId: string) {
    return this.prisma.category.findMany({
      where: { ownerId: userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async createProduct(
    dto: CreateProductDto,
    ownerId: string,
    actorName: string,
    actorId?: string,
  ) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, ownerId },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    const existingProduct = await this.prisma.product.findFirst({
      where: {
        ownerId,
        name: {
          equals: dto.name.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingProduct) {
      throw new ConflictException('You already have a product with this name.');
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        categoryId: dto.categoryId,
        ownerId,
        price: new Prisma.Decimal(dto.price),
        stockQuantity: dto.stockQuantity,
        minStockThreshold: dto.minStockThreshold,
        status:
          dto.stockQuantity === 0
            ? ProductStatus.OUT_OF_STOCK
            : dto.status ?? ProductStatus.ACTIVE,
      },
      include: { category: true },
    });

    await this.logActivity(
      actorName,
      'PRODUCT_CREATED',
      'product',
      product.id,
      `Product "${product.name}" added`,
      actorId,
    );

    return product;
  }

  getProducts(userId: string) {
    return this.prisma.product.findMany({
      where: { ownerId: userId },
      orderBy: [{ stockQuantity: 'asc' }, { name: 'asc' }],
      include: { category: true },
    });
  }

  async restockProduct(
    id: string,
    dto: RestockProductDto,
    ownerId: string,
    actorName: string,
    actorId?: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, ownerId },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        stockQuantity: { increment: dto.quantity },
        status: ProductStatus.ACTIVE,
      },
      include: { category: true },
    });

    await this.logActivity(
      actorName,
      'PRODUCT_RESTOCKED',
      'product',
      id,
      `Stock updated for "${updated.name}"`,
      actorId,
    );

    return updated;
  }

  async createOrder(dto: CreateOrderDto, actor: { id: string; name: string }) {
    const uniqueIds = new Set(dto.items.map((item) => item.productId));
    if (uniqueIds.size !== dto.items.length) {
      throw new BadRequestException('This product is already added to the order.');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.items.map((item) => item.productId) },
        ownerId: actor.id,
      },
    });

    if (products.length !== dto.items.length) {
      throw new NotFoundException('One or more products were not found.');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    let totalPrice = new Prisma.Decimal(0);

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;

      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException('This product is currently unavailable.');
      }

      if (item.quantity > product.stockQuantity) {
        throw new BadRequestException(
          `Only ${product.stockQuantity} items available in stock.`,
        );
      }

      totalPrice = totalPrice.plus(
        new Prisma.Decimal(product.price).mul(item.quantity),
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          customerName: dto.customerName,
          status: dto.status ?? OrderStatus.CONFIRMED,
          totalPrice,
          createdById: actor.id,
        },
      });

      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: product.id,
            quantity: item.quantity,
            unitPrice: product.price,
            totalPrice: new Prisma.Decimal(product.price).mul(item.quantity),
          },
        });

        const nextStock = product.stockQuantity - item.quantity;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: nextStock,
            status:
              nextStock <= 0 ? ProductStatus.OUT_OF_STOCK : ProductStatus.ACTIVE,
          },
        });
      }

      return createdOrder;
    });

    await this.logActivity(
      actor.name,
      'ORDER_CREATED',
      'order',
      order.id,
      `Order #${order.orderNumber} created by user`,
      actor.id,
    );

    return this.getOrderById(order.id, actor.id);
  }

  async updateOrderStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actor: { id: string; name: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, createdById: actor.id },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.logActivity(
      actor.name,
      'ORDER_STATUS_UPDATED',
      'order',
      id,
      `Order #${updated.orderNumber} marked as ${dto.status}`,
      actor.id,
    );

    return this.getOrderById(id, actor.id);
  }

  async cancelOrder(id: string, actor: { id: string; name: string }) {
    const order = await this.prisma.order.findFirst({
      where: { id, createdById: actor.id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.status !== OrderStatus.CANCELLED) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: { status: OrderStatus.CANCELLED },
        });

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { increment: item.quantity },
              status: ProductStatus.ACTIVE,
            },
          });
        }
      });

      await this.logActivity(
        actor.name,
        'ORDER_CANCELLED',
        'order',
        id,
        `Order #${order.orderNumber} cancelled`,
        actor.id,
      );
    }

    return this.getOrderById(id, actor.id);
  }

  getOrders(userId: string, query: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      createdById: userId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.date) {
      const start = new Date(query.date);
      const end = new Date(query.date);
      end.setDate(end.getDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    });
  }

  async getRestockQueue(userId: string) {
    const products = await this.prisma.product.findMany({
      where: { ownerId: userId },
      orderBy: [{ stockQuantity: 'asc' }, { updatedAt: 'desc' }],
      include: { category: true },
    });

    return products
      .filter((product) => product.stockQuantity <= product.minStockThreshold)
      .map((product) => ({
        ...product,
        priority:
          product.stockQuantity === 0
            ? 'High'
            : product.stockQuantity <=
                Math.max(1, Math.floor(product.minStockThreshold / 2))
              ? 'Medium'
              : 'Low',
      }));
  }

  async getDashboard(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [
      totalOrdersToday,
      pendingOrders,
      completedOrders,
      revenueTodayAgg,
      productSummary,
      queue,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { createdAt: { gte: start, lt: end }, createdById: userId },
      }),
      this.prisma.order.count({
        where: {
          createdById: userId,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
        },
      }),
      this.prisma.order.count({
        where: {
          createdById: userId,
          status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: {
          createdById: userId,
          createdAt: { gte: start, lt: end },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      this.prisma.product.findMany({
        where: { ownerId: userId },
        orderBy: [{ stockQuantity: 'asc' }, { name: 'asc' }],
        take: 6,
      }),
      this.getRestockQueue(userId),
    ]);

    return {
      totalOrdersToday,
      pendingOrders,
      completedOrders,
      lowStockItemsCount: queue.length,
      revenueToday: Number(revenueTodayAgg._sum.totalPrice ?? 0),
      productSummary: productSummary.map((product) => ({
        id: product.id,
        name: product.name,
        stockQuantity: product.stockQuantity,
        label:
          product.stockQuantity <= product.minStockThreshold ? 'Low Stock' : 'OK',
      })),
    };
  }

  getActivity(userId: string, limit = 10) {
    return this.prisma.activityLog.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private getOrderById(id: string, userId: string) {
    return this.prisma.order.findFirst({
      where: { id, createdById: userId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    });
  }

  private logActivity(
    actorName: string,
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    actorId?: string,
  ) {
    return this.prisma.activityLog.create({
      data: {
        actorId,
        actorName,
        action,
        entityType,
        entityId,
        description,
      },
    });
  }
}
