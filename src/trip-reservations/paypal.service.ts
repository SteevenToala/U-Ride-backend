import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PaypalVerificationResult {
  success: boolean;
  message: string;
}

/**
 * Verifica y captura órdenes de PayPal contra la API REST de PayPal.
 * Puerto de la verificación usada en u2_proyecto_flask (compras_controller.verificar_pago_paypal).
 */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);

  constructor(private readonly configService: ConfigService) {}

  async verifyOrder(orderId: string): Promise<PaypalVerificationResult> {
    const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    const secret = this.configService.get<string>('PAYPAL_SECRET');
    const environment = this.configService.get<string>('PAYPAL_ENV', 'sandbox');

    const baseUrl =
      environment === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

    if (!clientId || !secret) {
      return {
        success: false,
        message: 'Error de autenticación con PayPal (Verifica tus credenciales en el .env)',
      };
    }

    try {
      // 1. Obtener token de acceso de PayPal
      const tokenResponse = await axios.post(
        `${baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: clientId, password: secret },
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en_US',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          validateStatus: () => true,
        },
      );

      if (tokenResponse.status !== 200) {
        return {
          success: false,
          message: 'Error de autenticación con PayPal (Verifica tus credenciales en el .env)',
        };
      }

      const accessToken = tokenResponse.data.access_token;

      // 2. Capturar el pago (verificar que el usuario pagó)
      const captureResponse = await axios.post(
        `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          validateStatus: () => true,
        },
      );

      // 201: capturada exitosamente, 200: ya había sido capturada / info de orden
      if (captureResponse.status === 200 || captureResponse.status === 201) {
        if (captureResponse.data?.status === 'COMPLETED') {
          return { success: true, message: 'Pago completado' };
        }
      }

      return {
        success: false,
        message: 'El pago no pudo ser procesado o no fue completado en PayPal.',
      };
    } catch (error) {
      this.logger.error(`Error al conectar con PayPal: ${error.message}`);
      return { success: false, message: `Error al conectar con PayPal: ${error.message}` };
    }
  }
}
