export class UpdateUserDto {
    name?: string;
    lastname?: string;
    career?: string;
    reference_zone?: string;
    phone?: string;
    image?: string;
    notification_token?: string;
    is_suspended?: boolean;
    suspended_until?: Date;
}