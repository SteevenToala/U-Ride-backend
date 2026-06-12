import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Rol } from '../roles/rol.entity';
import { JwtService } from '@nestjs/jwt';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';

jest.setTimeout(30000);

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let usersRepository: Repository<User>;
  let rolesRepository: Repository<Rol>;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRolRepo = {
    findOneBy: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-token'),
  };

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Silenciar console.log y console.error durante las pruebas para mantener limpia la consola
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Rol),
          useValue: mockRolRepo,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    rolesRepository = module.get<Repository<Rol>>(getRepositoryToken(Rol));
    jwtService = module.get<JwtService>(JwtService);

    // Reset mocks
    jest.clearAllMocks();
    process.env.INSTITUTIONAL_EMAIL_DOMAIN = '@uta.edu.ec';
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('RF-001: Registro con Correo Institucional', () => {
    it('TC-RF001-01: Debe registrar con éxito un correo con dominio oficial válido', async () => {
      const dto = {
        name: 'Jonathan',
        lastname: 'López',
        email: 'estudiante@uta.edu.ec',
        phone: '0991234567',
        password: 'Pass1234*',
        career: 'Software',
        reference_zone: 'Ficoa',
        rolesIds: ['STUDENT'],
      };

      mockUserRepo.findOneBy.mockResolvedValueOnce(null); // Correo no existe
      mockUserRepo.findOneBy.mockResolvedValueOnce(null); // Teléfono no existe
      mockRolRepo.findOneBy.mockResolvedValue({ id: 'STUDENT', name: 'STUDENT' });
      mockUserRepo.create.mockReturnValue({ ...dto, id: '1', roles: [{ id: 'STUDENT' }] });
      mockUserRepo.save.mockResolvedValue({ id: '1', name: 'Jonathan', email: 'estudiante@uta.edu.ec', roles: [{ id: 'STUDENT' }] });

      const result = await service.register(dto);

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('estudiante@uta.edu.ec');
      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
    }, 30000);

    it('TC-RF001-02: Debe lanzar un error (400 Bad Request) si el correo es personal (ej. gmail, hotmail)', async () => {
      const dto = {
        name: 'Jonathan',
        lastname: 'López',
        email: 'estudiante@gmail.com',
        phone: '0991234567',
        password: 'Pass1234*',
        career: 'Software',
        reference_zone: 'Ficoa',
        rolesIds: ['STUDENT'],
      };

      mockUserRepo.findOneBy.mockResolvedValueOnce(null);

      await expect(service.register(dto)).rejects.toThrow(
        new HttpException('Solo se permiten correos institucionales', HttpStatus.BAD_REQUEST),
      );
    });

    it('TC-RF001-03: Debe rechazar la verificación (400 Bad Request) si el código de verificación/token es incorrecto o alterado', async () => {
      const email = 'estudiante@uta.edu.ec';
      const wrongCode = '123xyzAlterado';
      
      const unverifiedUser = {
        email,
        institutional_verified: false,
        email_verification_code: '654321', // Código correcto
      };

      mockUserRepo.findOneBy.mockResolvedValueOnce(unverifiedUser);

      await expect(service.verifyAccount(email, wrongCode)).rejects.toThrow(
        new HttpException('El código de verificación es incorrecto', HttpStatus.BAD_REQUEST),
      );
    });

    it('TC-RF001-03: Debe denegar el inicio de sesión (403 Forbidden) si el usuario no ha verificado su cuenta', async () => {
      const loginDto = {
        email: 'estudiante2@uta.edu.ec',
        password: 'Pass1234*',
      };

      const unverifiedUser = {
        id: 'user-unverified',
        email: 'estudiante2@uta.edu.ec',
        password: 'hashed-password',
        institutional_verified: false, // No verificado
        is_approved: true,
        is_suspended: false,
        roles: [{ id: 'STUDENT' }],
      };

      mockUserRepo.findOne.mockResolvedValue(unverifiedUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        new HttpException('Cuenta pendiente de verificacion institucional', HttpStatus.FORBIDDEN),
      );
    });
  });

  describe('RF-011: Bloqueo de sesión por suspensión', () => {
    it('TC-RF011-02: Debe denegar el acceso (403 Forbidden) en login si el usuario está suspendido administrativamente', async () => {
      const loginDto = {
        email: 'suspendido@uta.edu.ec',
        password: 'Pass1234*',
      };

      const suspendedUser = {
        id: 'user-suspended',
        name: 'Adiel Mariño',
        email: 'suspendido@uta.edu.ec',
        password: 'hashed-password',
        is_approved: true,
        institutional_verified: true,
        is_suspended: true,
        suspended_until: new Date(Date.now() + 1000 * 60 * 60 * 24), // Suspendido por 1 día
        roles: [{ id: 'STUDENT' }],
      };

      mockUserRepo.findOne.mockResolvedValue(suspendedUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        new HttpException('Cuenta suspendida temporalmente por administracion', HttpStatus.FORBIDDEN),
      );
    });
  });
});
