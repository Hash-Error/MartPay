import { Injectable, NotImplementedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async register(registerDto: RegisterDto) {
    // Skeletons only - no business logic implemented
    throw new NotImplementedException('Registration features are not yet implemented.');
  }

  async login(loginDto: LoginDto) {
    // Skeletons only - no business logic implemented
    throw new NotImplementedException('Login features are not yet implemented.');
  }
}
