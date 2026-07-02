import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AssignEmployeeDto } from './dto/assign-employee.dto';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async create(createStoreDto: CreateStoreDto) {
    const store = await this.prisma.store.create({
      data: {
        name: createStoreDto.name,
        phoneNumber: createStoreDto.phoneNumber,
        setting: {
          create: {
            taxRate: 0.0,
            currency: 'USD',
            timezone: 'UTC',
          },
        },
      },
      include: {
        setting: true,
      },
    });

    return { status: 'success', data: { store } };
  }

  async findById(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id, isActive: true },
      include: {
        setting: true,
        locations: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found or is inactive');
    }

    return { status: 'success', data: { store } };
  }

  async update(id: string, updateStoreDto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({ where: { id, isActive: true } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const updated = await this.prisma.store.update({
      where: { id },
      data: updateStoreDto,
    });

    return { status: 'success', data: { store: updated } };
  }

  async updateSettings(storeId: string, updateSettingsDto: UpdateSettingsDto) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId, isActive: true } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const setting = await this.prisma.storeSetting.upsert({
      where: { storeId },
      update: updateSettingsDto,
      create: {
        storeId,
        taxRate: updateSettingsDto.taxRate ?? 0.0,
        currency: updateSettingsDto.currency ?? 'USD',
        timezone: updateSettingsDto.timezone ?? 'UTC',
      },
    });

    return { status: 'success', data: { settings: setting } };
  }

  // ----------------------------------------------------
  // LOCATIONS
  // ----------------------------------------------------

  async getLocations(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId, isActive: true } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const locations = await this.prisma.storeLocation.findMany({
      where: { storeId },
    });

    return { status: 'success', data: { locations } };
  }

  async addLocation(storeId: string, createLocationDto: CreateLocationDto) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId, isActive: true } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const location = await this.prisma.storeLocation.create({
      data: {
        storeId,
        ...createLocationDto,
      },
    });

    return { status: 'success', data: { location } };
  }

  // ----------------------------------------------------
  // EMPLOYEES & ROLES (Store RBAC)
  // ----------------------------------------------------

  async getEmployees(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId, isActive: true } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const employees = await this.prisma.storeEmployee.findMany({
      where: { storeId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
        role: true,
      },
    });

    return { status: 'success', data: { employees } };
  }

  async assignEmployee(storeId: string, assignEmployeeDto: AssignEmployeeDto) {
    const { userId, roleId } = assignEmployeeDto;
    
    // Verify store exists
    const store = await this.prisma.store.findUnique({ where: { id: storeId, isActive: true } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId, isActive: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify role exists
    const role = await this.prisma.storeRole.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Store role not found');
    }

    const employee = await this.prisma.storeEmployee.upsert({
      where: {
        storeId_userId: {
          storeId,
          userId,
        },
      },
      update: {
        roleId,
      },
      create: {
        storeId,
        userId,
        roleId,
      },
      include: {
        role: true,
      },
    });

    return { status: 'success', data: { employee } };
  }

  async removeEmployee(storeId: string, employeeId: string) {
    const employee = await this.prisma.storeEmployee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.storeId !== storeId) {
      throw new NotFoundException('Employee register not found for this store');
    }

    await this.prisma.storeEmployee.delete({
      where: { id: employeeId },
    });

    return { status: 'success', message: 'Employee successfully removed from store' };
  }

  async createRole(createRoleDto: CreateRoleDto) {
    const existing = await this.prisma.storeRole.findUnique({
      where: { name: createRoleDto.name },
    });
    if (existing) {
      throw new ConflictException('Store role already exists');
    }

    const role = await this.prisma.storeRole.create({
      data: createRoleDto,
    });

    return { status: 'success', data: { role } };
  }

  async getRoles() {
    const roles = await this.prisma.storeRole.findMany();
    return { status: 'success', data: { roles } };
  }

  // Helper method: verifies if a user has a required permission in a specific store context
  async checkEmployeePermission(userId: string, storeId: string, requiredPermission: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    
    // Global admin automatically bypasses store permissions check
    if (user.role === 'admin') return true;

    const employee = await this.prisma.storeEmployee.findUnique({
      where: {
        storeId_userId: {
          storeId,
          userId,
        },
      },
      include: {
        role: true,
      },
    });

    if (!employee) return false;
    return employee.role.permissions.includes(requiredPermission);
  }
}
