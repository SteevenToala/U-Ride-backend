import { IsString, IsEmail, IsNotEmpty, IsOptional, MinLength, Matches } from "class-validator";

export class RegisterAuthDto {
    
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    lastname: string;

    @IsNotEmpty()
    @IsString()
    @IsEmail({}, { message: 'El email no es valido' })
    @Matches(/@.*\.edu(\.[a-z]{2})?$/, { message: 'Debe usar un correo institucional válido (.edu)' })
    email: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsNotEmpty()
    @IsString()
    career: string;

    @IsNotEmpty()
    @IsString()
    reference_zone: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener minimo 6 caracteres' })
    password: string;
    
    rolesIds: string[];

    @IsOptional()
    @IsString()
    verificationCode?: string;

}