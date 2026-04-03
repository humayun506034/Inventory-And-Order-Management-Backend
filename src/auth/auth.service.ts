import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.ensureDemoUser(
        UserRole.ADMIN,
        this.configService.get<string>('DEMO_ADMIN_EMAIL') ?? 'admin@gmail.com',
        this.configService.get<string>('DEMO_ADMIN_PASSWORD') ?? 'Admin12345',
        'Demo Admin',
      ),
      this.ensureDemoUser(
        UserRole.MANAGER,
        this.configService.get<string>('DEMO_MANAGER_EMAIL') ?? 'manager@gmail.com',
        this.configService.get<string>('DEMO_MANAGER_PASSWORD') ?? 'Manager12345',
        'Demo Manager',
      ),
    ]);
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role ?? UserRole.MANAGER,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.buildAuthResponse(user);
  }

  demoLogin(role: UserRole = UserRole.ADMIN) {
    const isAdmin = role === UserRole.ADMIN;
    return this.login({
      email: isAdmin
        ? this.configService.get<string>('DEMO_ADMIN_EMAIL') ?? 'admin@gmail.com'
        : this.configService.get<string>('DEMO_MANAGER_EMAIL') ?? 'manager@gmail.com',
      password: isAdmin
        ? this.configService.get<string>('DEMO_ADMIN_PASSWORD') ?? 'Admin12345'
        : this.configService.get<string>('DEMO_MANAGER_PASSWORD') ?? 'Manager12345',
    });
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  }) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return {
      accessToken,
      user,
      demoCredentials: {
        admin: {
          email:
            this.configService.get<string>('DEMO_ADMIN_EMAIL') ?? 'admin@gmail.com',
          password:
            this.configService.get<string>('DEMO_ADMIN_PASSWORD') ?? 'Admin12345',
        },
        manager: {
          email:
            this.configService.get<string>('DEMO_MANAGER_EMAIL') ?? 'manager@gmail.com',
          password:
            this.configService.get<string>('DEMO_MANAGER_PASSWORD') ?? 'Manager12345',
        },
      },
    };
  }

  private async ensureDemoUser(
    role: UserRole,
    email: string,
    password: string,
    name: string,
  ) {
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;

    await this.prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  }
}
