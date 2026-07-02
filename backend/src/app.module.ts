import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './cache/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { StoresModule } from './modules/stores/stores.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Global Configurations
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Core Modules
    PrismaModule,
    RedisModule,
    HealthModule,

    // Base Business Modules
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    AuditLogsModule,
    StoresModule,
    InventoryModule,
    PaymentsModule,
    NotificationsModule,
    AdminModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
