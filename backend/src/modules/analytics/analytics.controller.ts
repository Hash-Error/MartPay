import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Analytics (Sales, Products, Customers, Growth)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue summary: total, today, this week, this month, avg order value' })
  getRevenueSummary() {
    return this.analyticsService.getRevenueSummary();
  }

  @Get('daily')
  @ApiOperation({ summary: 'Daily sales revenue and count — last 30 days' })
  getDailySales() {
    return this.analyticsService.getDailySales();
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Weekly sales revenue and count — last 12 weeks' })
  getWeeklySales() {
    return this.analyticsService.getWeeklySales();
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Monthly sales revenue and count — last 12 months' })
  getMonthlySales() {
    return this.analyticsService.getMonthlySales();
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top products by revenue — last 30 days' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getTopProducts(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return this.analyticsService.getTopProducts(limit);
  }

  @Get('peak-hours')
  @ApiOperation({ summary: 'Order distribution by hour of day — last 30 days' })
  getPeakHours() {
    return this.analyticsService.getPeakHours();
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer insights: total, new, returning, weekly signup series' })
  getCustomerInsights() {
    return this.analyticsService.getCustomerInsights();
  }

  @Get('growth')
  @ApiOperation({ summary: 'Month-over-month revenue growth percentage — last 12 months' })
  getGrowthCharts() {
    return this.analyticsService.getGrowthCharts();
  }
}
