import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Stores & Roles Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new supermarket store registry (Admin only)' })
  @ApiResponse({ status: 201, description: 'Store successfully created.' })
  async create(@Body() createStoreDto: CreateStoreDto) {
    return this.storesService.create(createStoreDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve store parameters and locations' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store details returned.' })
  async findById(@Param('id') id: string) {
    return this.storesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update store parameters' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store details updated.' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    // Check permission: user must be global admin or have manage:store permission on this store
    const isAuthorized = await this.storesService.checkEmployeePermission(userId, id, 'manage:store');
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to manage this store');
    }
    return this.storesService.update(id, updateStoreDto);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update store-wide billing/timezone settings' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store settings updated.' })
  async updateSettings(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    const isAuthorized = await this.storesService.checkEmployeePermission(userId, id, 'manage:settings');
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to manage store settings');
    }
    return this.storesService.updateSettings(id, updateSettingsDto);
  }

  @Get(':id/locations')
  @ApiOperation({ summary: 'Retrieve physical locations list' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store locations list returned.' })
  async getLocations(@Param('id') id: string) {
    return this.storesService.getLocations(id);
  }

  @Post(':id/locations')
  @ApiOperation({ summary: 'Add a new location registry to store' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 201, description: 'Location added successfully.' })
  async addLocation(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() createLocationDto: CreateLocationDto,
  ) {
    const isAuthorized = await this.storesService.checkEmployeePermission(userId, id, 'manage:locations');
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to add locations to this store');
    }
    return this.storesService.addLocation(id, createLocationDto);
  }

  @Get(':id/employees')
  @ApiOperation({ summary: 'Retrieve list of active employees' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store employees returned.' })
  async getEmployees(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const isAuthorized = await this.storesService.checkEmployeePermission(userId, id, 'view:employees');
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to view store employees');
    }
    return this.storesService.getEmployees(id);
  }

  @Post(':id/employees')
  @ApiOperation({ summary: 'Assign a user to the store with a role' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiResponse({ status: 201, description: 'User successfully assigned to store.' })
  async assignEmployee(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() assignEmployeeDto: AssignEmployeeDto,
  ) {
    const isAuthorized = await this.storesService.checkEmployeePermission(userId, id, 'manage:employees');
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to assign employees to this store');
    }
    return this.storesService.assignEmployee(id, assignEmployeeDto);
  }

  @Delete(':id/employees/:employeeId')
  @ApiOperation({ summary: 'Remove employee registry from store' })
  @ApiParam({ name: 'id', description: 'Store ID' })
  @ApiParam({ name: 'employeeId', description: 'Employee Registry ID' })
  @ApiResponse({ status: 200, description: 'Employee removed successfully.' })
  async removeEmployee(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
  ) {
    const isAuthorized = await this.storesService.checkEmployeePermission(userId, id, 'manage:employees');
    if (!isAuthorized) {
      throw new ForbiddenException('You do not have permission to remove employees from this store');
    }
    return this.storesService.removeEmployee(id, employeeId);
  }

  @Post('roles')
  @Roles('admin')
  @ApiOperation({ summary: 'Define new store role & permission scope (Admin only)' })
  @ApiResponse({ status: 201, description: 'Role created.' })
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.storesService.createRole(createRoleDto);
  }

  @Get('roles')
  @Roles('admin')
  @ApiOperation({ summary: 'Get list of configured store roles (Admin only)' })
  @ApiResponse({ status: 200, description: 'Roles list returned.' })
  async getRoles() {
    return this.storesService.getRoles();
  }
}
