import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import type { AuthenticatedRequest } from '../common/guards/auth.guard';
import { InventoryService } from './inventory.service';
import {
  CreateCategoryDto,
  CreateOrderDto,
  CreateProductDto,
  OrderQueryDto,
  RestockProductDto,
  UpdateOrderStatusDto,
} from './dto/inventory.dto';

@Controller()
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('bootstrap')
  bootstrap(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.getBootstrapData(req.user);
  }

  @Get('dashboard')
  dashboard(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.getDashboard(req.user);
  }

  @Get('categories')
  categories(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.getCategories(req.user);
  }

  @Post('categories')
  createCategory(
    @Body() dto: CreateCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.createCategory(
      dto,
      req.user.sub,
      req.user.name,
      req.user.sub,
    );
  }

  @Get('products')
  products(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.getProducts(req.user);
  }

  @Post('products')
  createProduct(
    @Body() dto: CreateProductDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.createProduct(
      dto,
      req.user.sub,
      req.user.name,
      req.user.sub,
    );
  }

  @Patch('products/:id/restock')
  restock(
    @Param('id') id: string,
    @Body() dto: RestockProductDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.restockProduct(
      id,
      dto,
      req.user.sub,
      req.user.name,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('restock-queue')
  restockQueue(@Req() req: AuthenticatedRequest) {
    return this.inventoryService.getRestockQueue(req.user);
  }

  @Get('orders')
  orders(@Query() query: OrderQueryDto, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.getOrders(req.user, query);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.createOrder(dto, {
      id: req.user.sub,
      name: req.user.name,
      role: req.user.role,
    });
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.updateOrderStatus(id, dto, {
      id: req.user.sub,
      name: req.user.name,
      role: req.user.role,
    });
  }

  @Patch('orders/:id/cancel')
  cancelOrder(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.cancelOrder(id, {
      id: req.user.sub,
      name: req.user.name,
      role: req.user.role,
    });
  }

  @Get('activity')
  activity(@Query('limit') limit: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.inventoryService.getActivity(req.user, limit ? Number(limit) : 10);
  }
}
