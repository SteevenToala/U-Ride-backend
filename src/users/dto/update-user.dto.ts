import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    lastname?: string;

    @IsOptional()
    @IsString()
    career?: string;

    @IsOptional()
    @IsString()
    reference_zone?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsString()
    notification_token?: string;

    @IsOptional()
    @IsBoolean()
    is_suspended?: boolean;

    @IsOptional()
    @IsDateString()
    suspended_until?: Date;
}