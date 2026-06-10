import { Test, TestingModule } from '@nestjs/testing';
import { PaypalService } from './paypal.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaypalService (Unit Tests)', () => {
  let service: PaypalService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'PAYPAL_CLIENT_ID') return 'mock-client-id';
      if (key === 'PAYPAL_SECRET') return 'mock-secret';
      if (key === 'PAYPAL_ENV') return 'sandbox';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaypalService>(PaypalService);
    configService = module.get<ConfigService>(ConfigService);

    jest.resetAllMocks();
    mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'PAYPAL_CLIENT_ID') return 'mock-client-id';
      if (key === 'PAYPAL_SECRET') return 'mock-secret';
      if (key === 'PAYPAL_ENV') return 'sandbox';
      return defaultValue;
    });
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('verifyOrder', () => {
    it('debe validar exitosamente cuando PayPal procesa y completa la orden', async () => {
      // Mock OAuth response
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'mock-access-token' },
      });

      // Mock Capture response
      mockedAxios.post.mockResolvedValueOnce({
        status: 201,
        data: { status: 'COMPLETED' },
      });

      const result = await service.verifyOrder('order-id-123');

      expect(result).toEqual({ success: true, message: 'Pago completado' });
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('debe retornar error si las credenciales de PayPal faltan en el .env', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const result = await service.verifyOrder('order-id-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error de autenticación');
    });

    it('debe retornar error si falla la autenticación de OAuth (credenciales inválidas)', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 401,
        data: {},
      });

      const result = await service.verifyOrder('order-id-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error de autenticación');
    });

    it('debe retornar error si la orden no se encuentra en estado COMPLETED', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'mock-access-token' },
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { status: 'APPROVED' }, // No completada aún
      });

      const result = await service.verifyOrder('order-id-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('no pudo ser procesado o no fue completado');
    });

    it('debe retornar error si ocurre una excepción de red o de axios', async () => {
      // 1. Mock token request success
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { access_token: 'mock-access-token' },
      });

      // 2. Mock capture network failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Conexión perdida'));

      const result = await service.verifyOrder('order-id-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error al conectar con PayPal');
    });
  });
});
