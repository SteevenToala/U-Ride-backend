export class CreateUserDto {

    name: string;
    lastname: string;
    career: string;
    reference_zone: string;
    email: string;
    phone?: string;
    password: string;
    image?: string;
    notification_token?: string;
}