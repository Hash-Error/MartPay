import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 409, description: 'Username already exists.' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user credentials' })
  @ApiResponse({ status: 200, description: 'Authentication successful. Returns tokens.' })
  @ApiResponse({ status: 401, description: 'Invalid username or password.' })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Terminate active session' })
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout(@CurrentUser('sessionId') sessionId: string, @CurrentUser('sub') userId: string) {
    return this.authService.logout(sessionId, userId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate session tokens using refresh token' })
  @ApiResponse({ status: 200, description: 'Token rotated. Returns new access and refresh tokens.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.refresh(refreshToken, ipAddress, userAgent);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate password reset (Generate numeric OTP)' })
  @ApiResponse({ status: 200, description: 'Reset OTP issued.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify reset password OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP.' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password using verification OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successful.' })
  @ApiResponse({ status: 400, description: 'Invalid/expired OTP or weak password.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current password' })
  @ApiResponse({ status: 200, description: 'Password updated successfully.' })
  @ApiResponse({ status: 401, description: 'Incorrect old password.' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register user hardware profile & push notifications token' })
  @ApiResponse({ status: 200, description: 'Device associated successfully.' })
  async registerDevice(
    @CurrentUser('sub') userId: string,
    @Body() registerDeviceDto: RegisterDeviceDto,
  ) {
    return this.authService.registerDevice(userId, registerDeviceDto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of active login sessions' })
  @ApiResponse({ status: 200, description: 'Sessions list returned.' })
  async getSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(userId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke/terminate specific active session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session successfully revoked.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  async revokeSession(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(userId, sessionId);
  }
}
