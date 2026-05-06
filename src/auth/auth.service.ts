import * as nodemailer from 'nodemailer';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Repository, In } from 'typeorm';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { compare, hash } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Rol } from '../roles/rol.entity';
import { saveLocalFile } from '../utils/local_storage';


@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(User) private usersRepository: Repository<User>,
        @InjectRepository(Rol) private rolesRepository: Repository<Rol>,

        private jwtService: JwtService
    ) {}

    async register(user: RegisterAuthDto, file?: Express.Multer.File) {
        const { email, phone } = user;
        const normalizedEmail = email.trim().toLowerCase();
        const emailExist = await this.usersRepository.findOneBy({ email: normalizedEmail });

        if (emailExist) {
            throw new HttpException('El email ya esta registrado', HttpStatus.CONFLICT);
        }

        const configuredDomain = (process.env.INSTITUTIONAL_EMAIL_DOMAIN || '').trim().toLowerCase();
        const isByConfiguredDomain = configuredDomain !== '' && normalizedEmail.endsWith(configuredDomain);
        const isByEduPattern = /^[^\s@]+@[^\s@]+\.(edu|ac)\.[^\s@]+$/i.test(normalizedEmail);

        if (!isByConfiguredDomain && !isByEduPattern) {
            throw new HttpException(
                'Solo se permiten correos institucionales',
                HttpStatus.BAD_REQUEST
            );
        }

        if (phone) {
            const phoneExist = await this.usersRepository.findOneBy({ phone: phone });

            if (phoneExist) {
                throw new HttpException('El telefono ya esta registrado', HttpStatus.CONFLICT);
            }
        }

        // Generar código de verificación de 6 dígitos
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const newUser = this.usersRepository.create({
            ...user,
            email: normalizedEmail,
            institutional_verified: false, // Ahora inicia como falso
            email_verification_code: verificationCode,
            is_approved: true,
            is_driver_approved: false
        });

        if (file) {
            const imagePath = await saveLocalFile(file, 'users');
            newUser.image = imagePath;
        }

        // Everyone registers as STUDENT first
        const studentRole = await this.rolesRepository.findOneBy({ id: 'STUDENT' });
        newUser.roles = [studentRole];

        const userSaved = await this.usersRepository.save(newUser);

        // Enviar correo de verificación
        try {
            console.log(`Intentando enviar correo de verificación a: ${normalizedEmail}`);
            await this.sendEmail(
                normalizedEmail,
                'Verificación de Cuenta - U-RIDE',
                `Hola ${userSaved.name}. Bienvenido a U-RIDE.\n\nPara activar tu cuenta, ingresa el siguiente código de verificación: ${verificationCode}\n\nSi no te registraste en nuestra plataforma, ignora este mensaje.`
            );
            console.log(`Correo de verificación enviado exitosamente a: ${normalizedEmail}`);
        } catch (error) {
            console.error('Error al enviar correo de verificación:', error);
            // No bloqueamos el registro si el correo falla, pero informamos al usuario (opcional)
        }

        const rolesString = newUser.roles.map(rol => rol.id); // Usamos newUser para asegurar que roles existe
        const payload = { id: userSaved.id, name: userSaved.name, roles: rolesString };
        const token = this.jwtService.sign(payload);
        const data = {
            user: userSaved,
            token: 'Bearer ' + token
        }
        delete data.user.password;
        return data;
    }

    async verifyAccount(email: string, code: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const userFound = await this.usersRepository.findOneBy({ email: normalizedEmail });

        if (!userFound) {
            throw new HttpException('El correo no existe', HttpStatus.NOT_FOUND);
        }

        if (userFound.institutional_verified) {
            return {
                success: true,
                message: 'La cuenta ya se encuentra verificada'
            };
        }

        if (userFound.email_verification_code !== code) {
            throw new HttpException('El código de verificación es incorrecto', HttpStatus.BAD_REQUEST);
        }

        userFound.institutional_verified = true;
        userFound.email_verification_code = null;
        await this.usersRepository.save(userFound);

        return {
            success: true,
            message: 'Cuenta verificada exitosamente'
        };
    }

    private async sendEmail(to: string, subject: string, text: string) {
        console.log(`Preparando transporter para: ${to}`);
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
        });

        console.log(`Enviando correo desde: ${process.env.EMAIL_USER} a: ${to} con asunto: ${subject}`);
        const result = await transporter.sendMail({
            from: `"Soporte U-RIDE" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
        });
        console.log(`Resultado de sendMail: ${result.messageId}`);
        return result;
    }

    async login(loginData: LoginAuthDto) {

        const { email, password } = loginData;
        const userFound = await this.usersRepository.findOne({ 
            where: { email: email.trim().toLowerCase() },
            relations: ['roles']
         })
        if (!userFound) {
            throw new HttpException('El email no existe', HttpStatus.NOT_FOUND);
        }

        if (!userFound.institutional_verified) {
            throw new HttpException('Cuenta pendiente de verificacion institucional', HttpStatus.FORBIDDEN);
        }

        if (!userFound.is_approved) {
            throw new HttpException('Tu cuenta está pendiente de aprobación por un administrador', HttpStatus.FORBIDDEN);
        }

        if (userFound.is_suspended && (!userFound.suspended_until || userFound.suspended_until > new Date())) {
            throw new HttpException('Cuenta suspendida temporalmente por administracion', HttpStatus.FORBIDDEN);
        }
        
        const isPasswordValid = await compare(password, userFound.password);
        if (!isPasswordValid) {
            throw new HttpException('La contraseña es incorrecta', HttpStatus.FORBIDDEN);
        }

        const rolesIds = userFound.roles.map(rol => rol.id); //['CLIENT', 'ADMIN']

        const payload = { 
            id: userFound.id, 
            name: userFound.name, 
            roles: rolesIds 
        };
        const token = this.jwtService.sign(payload);
        const data = {
            user: userFound,
            token: 'Bearer ' + token
        }

        delete data.user.password;

        return data;
    }

    async forgotPassword(email: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const userFound = await this.usersRepository.findOneBy({ email: normalizedEmail });

        if (!userFound) {
            throw new HttpException('El correo electrónico no se encuentra registrado', HttpStatus.NOT_FOUND);
        }

        // Crear un token simple o código de recuperación (solo para demostración, idealmente usarías JWT y lo guardarías en DB)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        try {
            await this.sendEmail(
                normalizedEmail,
                "Recuperación de Contraseña",
                `Hola ${userFound.name}. Has solicitado recuperar tu contraseña. \n\nTu código de recuperación es: ${resetCode}\n\nEste código expirará en 15 minutos.\nSi no fuiste tú, ignora este correo.`
            );
            
            // Guardar en la base de datos el codigo y la expiracion (15 minutos)
            userFound.reset_password_code = resetCode;
            const expirationDate = new Date();
            expirationDate.setMinutes(expirationDate.getMinutes() + 15);
            userFound.reset_password_expires = expirationDate;
            await this.usersRepository.save(userFound);

            return {
                success: true,
                message: 'Si el correo existe, se han enviado las instrucciones de recuperación.'
            };
        } catch (error) {
            //console.error('ERROR ENVIANDO CORREO CON NODEMAILER:', error.message);
            throw new HttpException('Error al enviar el correo, verifica la configuración SMTP', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async validateResetCode(email: string, code: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const userFound = await this.usersRepository.findOneBy({ email: normalizedEmail });

        if (!userFound) {
            throw new HttpException('El correo no existe', HttpStatus.NOT_FOUND);
        }

        if (userFound.reset_password_code !== code) {
            throw new HttpException('El código es incorrecto', HttpStatus.BAD_REQUEST);
        }

        if (userFound.reset_password_expires < new Date()) {
            throw new HttpException('El código se ha caducado (pasaron más de 15 minutos)', HttpStatus.BAD_REQUEST);
        }

        return {
            success: true,
            message: 'Código válido'
        };
    }

    async resetPassword(email: string, code: string, newPassword: string) {
        // Volvemos a validar por seguridad extra antes de guardar
        await this.validateResetCode(email, code);

        const normalizedEmail = email.trim().toLowerCase();
        const userFound = await this.usersRepository.findOneBy({ email: normalizedEmail });
        
        // Encriptar la nueva clave manualmente ya que @BeforeInsert solo actúa cuando se inserta un nuevo registro, 
        // y aquí estamos haciendo un Update
        const hashedPassword = await hash(newPassword, Number(process.env.HASH_SALT));
        userFound.password = hashedPassword;
        
        // Limpiamos los campos de reseteo para que el código no pueda volver a usarse
        userFound.reset_password_code = null;
        userFound.reset_password_expires = null;
        
        await this.usersRepository.save(userFound);

        return {
            success: true,
            message: 'La contraseña ha sido actualizada exitosamente'
        };
    }

}
