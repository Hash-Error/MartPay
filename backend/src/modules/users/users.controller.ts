import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users & Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Retrieve active user profile details' })
  @ApiResponse({ status: 200, description: 'Profile returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile details' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @ApiResponse({ status: 400, description: 'Malformed request inputs.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user account (Soft-Delete)' })
  @ApiResponse({ status: 200, description: 'Account deactivated, sessions terminated.' })
  async deleteAccount(@CurrentUser('sub') userId: string) {
    return this.usersService.deleteAccount(userId);
  }

  // ----------------------------------------------------
  // ADDRESS BOOK MANAGEMENT
  // ----------------------------------------------------

  @Get('addresses')
  @ApiOperation({ summary: 'Retrieve user addresses book' })
  @ApiResponse({ status: 200, description: 'Addresses returned.' })
  async getAddresses(@CurrentUser('sub') userId: string) {
    return this.usersService.getAddresses(userId);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Create new address registry' })
  @ApiResponse({ status: 201, description: 'Address created successfully.' })
  async addAddress(
    @CurrentUser('sub') userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.usersService.addAddress(userId, createAddressDto);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update address parameters' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({ status: 200, description: 'Address updated successfully.' })
  async updateAddress(
    @CurrentUser('sub') userId: string,
    @Param('id') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(userId, addressId, updateAddressDto);
  }

  @Delete('addresses/:id')
  @ApiOperation({ summary: 'Delete address from profile book' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({ status: 200, description: 'Address removed successfully.' })
  async deleteAddress(
    @CurrentUser('sub') userId: string,
    @Param('id') addressId: string,
  ) {
    return this.usersService.deleteAddress(userId, addressId);
  }

  // ----------------------------------------------------
  // SAVED PAYMENT CARDS
  // ----------------------------------------------------

  @Get('payments')
  @ApiOperation({ summary: 'Retrieve saved payment cards' })
  @ApiResponse({ status: 200, description: 'Payment methods returned.' })
  async getPaymentMethods(@CurrentUser('sub') userId: string) {
    return this.usersService.getPaymentMethods(userId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Store new payment method token' })
  @ApiResponse({ status: 201, description: 'Payment card token stored.' })
  async addPaymentMethod(
    @CurrentUser('sub') userId: string,
    @Body() savePaymentMethodDto: SavePaymentMethodDto,
  ) {
    return this.usersService.addPaymentMethod(userId, savePaymentMethodDto);
  }

  @Delete('payments/:id')
  @ApiOperation({ summary: 'Delete stored payment method' })
  @ApiParam({ name: 'id', description: 'Payment Method ID' })
  @ApiResponse({ status: 200, description: 'Card removed successfully.' })
  async deletePaymentMethod(
    @CurrentUser('sub') userId: string,
    @Param('id') paymentMethodId: string,
  ) {
    return this.usersService.deletePaymentMethod(userId, paymentMethodId);
  }

  // ----------------------------------------------------
  // ALERTS & NOTIFICATIONS
  // ----------------------------------------------------

  @Get('notifications')
  @ApiOperation({ summary: 'Retrieve user alert settings' })
  @ApiResponse({ status: 200, description: 'Notification settings returned.' })
  async getNotificationSettings(@CurrentUser('sub') userId: string) {
    return this.usersService.getNotificationSettings(userId);
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification alert triggers' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully.' })
  async updateNotificationSettings(
    @CurrentUser('sub') userId: string,
    @Body() updateNotificationsDto: UpdateNotificationsDto,
  ) {
    return this.usersService.updateNotificationSettings(userId, updateNotificationsDto);
  }

  // ----------------------------------------------------
  // TRANSACTION PURCHASES HISTORY
  // ----------------------------------------------------

  @Get('purchases')
  @ApiOperation({ summary: 'Retrieve user completed purchases history' })
  @ApiResponse({ status: 200, description: 'Completed checkout transactions history returned.' })
  async getPurchaseHistory(@CurrentUser('sub') userId: string) {
    return this.usersService.getPurchaseHistory(userId);
  }
}
