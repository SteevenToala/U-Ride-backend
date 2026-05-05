import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';

@Controller('auth')
export class AuthController {

    constructor(private authService: AuthService) {}

    @Post('register') // http://localhost/auth/register -> POST 
    register(@Body() user: RegisterAuthDto) {
        return this.authService.register(user);
    }
    
    
    @Post('login') // http://localhost/auth/login -> POST 
    login(@Body() loginData: LoginAuthDto) {
        return this.authService.login(loginData);
    }

    @Post('forgot-password') // http://localhost/auth/forgot-password -> POST
    forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }

    @Post('validate-reset-code') // http://localhost/auth/validate-reset-code -> POST
    validateResetCode(@Body('email') email: string, @Body('code') code: string) {
        return this.authService.validateResetCode(email, code);
    }

    @Post('reset-password') // http://localhost/auth/reset-password -> POST
    resetPassword(@Body() resetData: any) {
        // En Produccion se debiera usar un DTO, por simplicidad usamos any
        return this.authService.resetPassword(resetData.email, resetData.code, resetData.newPassword);
    }

}
