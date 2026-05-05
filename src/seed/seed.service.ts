import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Rol } from '../roles/rol.entity';
import { hash } from 'bcrypt';

/**
 * SeedService: se ejecuta automáticamente al arrancar NestJS.
 * Crea el usuario administrador inicial si no existe.
 * Los roles ya son insertados por el script SQL init.sql de MySQL.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Rol) private rolesRepository: Repository<Rol>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRoles();
    await this.seedAdminUser();
  }

  /**
   * Asegura que los roles base existan en la BD.
   * El init.sql ya los inserta, pero esto actúa como fallback.
   */
  private async seedRoles() {
    const roles = [
      { id: 'STUDENT', name: 'Estudiante Pasajero',    image: '/icons/student.png', route: '/student' },
      { id: 'DRIVER',  name: 'Estudiante Conductor',   image: '/icons/driver.png',  route: '/driver'  },
      { id: 'ADMIN',   name: 'Administrador',           image: '/icons/admin.png',   route: '/admin'   },
    ];

    for (const roleData of roles) {
      const existing = await this.rolesRepository.findOneBy({ id: roleData.id });
      if (!existing) {
        await this.rolesRepository.save(this.rolesRepository.create(roleData));
        this.logger.log(`✅ Rol creado: ${roleData.id}`);
      }
    }
  }

  /**
   * Crea el administrador del sistema si no existe.
   * Credenciales desde variables de entorno: ADMIN_EMAIL y ADMIN_PASSWORD
   */
  private async seedAdminUser() {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@uride.edu.co').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const hashSalt = parseInt(process.env.HASH_SALT || '10', 10);

    const existing = await this.usersRepository.findOneBy({ email: adminEmail });

    if (existing) {
      this.logger.log(`ℹ️  Administrador ya existe: ${adminEmail}`);
      return;
    }

    const hashedPassword = await hash(adminPassword, hashSalt);
    const adminRole = await this.rolesRepository.findOneBy({ id: 'ADMIN' });

    if (!adminRole) {
      this.logger.error('❌ Rol ADMIN no encontrado. Verificar init.sql');
      return;
    }

    const admin = this.usersRepository.create({
      name: 'Admin',
      lastname: 'Sistema U-Ride',
      email: adminEmail,
      password: hashedPassword,
      institutional_verified: true,
      is_suspended: false,
      roles: [adminRole],
    });

    // Bypass del @BeforeInsert hashPassword para no re-hashear
    await this.usersRepository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        name: admin.name,
        lastname: admin.lastname,
        email: admin.email,
        password: hashedPassword,
        institutional_verified: true,
        is_suspended: false,
      })
      .execute()
      .then(async (result) => {
        const insertId = result.identifiers[0].id;
        await this.usersRepository
          .createQueryBuilder()
          .relation(User, 'roles')
          .of(insertId)
          .add('ADMIN');
        this.logger.log(`🔑 Administrador creado: ${adminEmail}`);
      });
  }
}
