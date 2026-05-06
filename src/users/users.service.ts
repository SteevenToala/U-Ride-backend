import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Rol } from '../roles/rol.entity';
import { saveLocalFile } from '../utils/local_storage';

@Injectable()
export class UsersService {

    constructor(
        @InjectRepository(User) private usersRepository: Repository<User>,
        @InjectRepository(Rol) private rolesRepository: Repository<Rol>,
    ) {}

    async requestDriverRole(id: number) {
        const userFound = await this.usersRepository.findOne({ 
            where: { id },
            relations: ['roles']
        });

        if (!userFound) {
            throw new HttpException('Usuario no existe', HttpStatus.NOT_FOUND);
        }

        const driverRole = await this.rolesRepository.findOneBy({ id: 'DRIVER' });
        if (!driverRole) {
            throw new HttpException('El rol de conductor no existe en el sistema', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Check if user already has the role
        const hasDriverRole = userFound.roles.some(rol => rol.id === 'DRIVER');
        
        if (!hasDriverRole) {
            userFound.roles.push(driverRole);
        }

        userFound.is_driver_approved = false; // Requires admin approval
        return this.usersRepository.save(userFound);
    }

    async approveDriverRole(id: number) {
        const userFound = await this.usersRepository.findOneBy({ id });

        if (!userFound) {
            throw new HttpException('Usuario no existe', HttpStatus.NOT_FOUND);
        }

        userFound.is_driver_approved = true;
        return this.usersRepository.save(userFound);
    }
    
    create(user: CreateUserDto) {
        const newUser = this.usersRepository.create(user);
        return this.usersRepository.save(newUser);
    }

    findOne(id: number) {
        return this.usersRepository.findOne({ where: { id }, relations: ['roles'] });
    }

    findAll() {
        return this.usersRepository.find({ relations: ['roles'] });
    }

    async findPendingDrivers() {
        const users = await this.usersRepository.find({ 
            relations: ['roles'],
            where: { is_driver_approved: false }
        });

        // Filter by role DRIVER manually since TypeORM many-to-many filtering can be complex for simple relations
        return users.filter(user => user.roles.some(rol => rol.id === 'DRIVER'));
    }

    async update(id: number, user: UpdateUserDto) {
        console.log('UPDATE DAT: ', user);
        
        const userFound = await this.usersRepository.findOneBy({id: id});

        if (!userFound) {
            throw new HttpException('Usuario no existe', HttpStatus.NOT_FOUND);
        }

        const updatedUser = Object.assign(userFound, user);
        return this.usersRepository.save(updatedUser);
    }

    async suspendUser(id: number, suspendedUntil: Date | null) {
        const userFound = await this.usersRepository.findOneBy({ id });

        if (!userFound) {
            throw new HttpException('Usuario no existe', HttpStatus.NOT_FOUND);
        }

        userFound.is_suspended = true;
        userFound.suspended_until = suspendedUntil;
        return this.usersRepository.save(userFound);
    }
    

    async updateWithImage(file: Express.Multer.File, id: number, user: UpdateUserDto) {
        const relativePath = await saveLocalFile(file, 'users');
        
        if (!relativePath) {
            throw new HttpException('La imagen no se pudo guardar', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const userFound = await this.usersRepository.findOneBy({id: id});

        if (!userFound) {
            throw new HttpException('Usuario no existe', HttpStatus.NOT_FOUND);
        }
        
        // En un entorno real, podrías querer guardar la URL completa incluyendo el host
        // Por ahora guardamos la ruta relativa que empieza por /uploads/
        user.image = relativePath; 
        const updatedUser = Object.assign(userFound, user);
        return this.usersRepository.save(updatedUser);
    }
    
}
