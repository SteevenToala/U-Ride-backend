import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PaypalVerificationResult {
  success: boolean;
  message: string;
}

/**
 * Recibe y captura órdenes de PayPal contra la API REST de PayPal.
 */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);

  constructor(private readonly configService: ConfigService) { }

  private async getAccessToken(clientId: string, secret: string, baseUrl: string): Promise<string | null> {
    try {
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
        this.logger.error(`PayPal Token Error: Status ${tokenResponse.status}, Data: ${JSON.stringify(tokenResponse.data)}`);
        return null;
      }
      return tokenResponse.data.access_token;
    } catch (e) {
      this.logger.error(`Error al obtener token de PayPal: ${e.message}`);
      return null;
    }
  }

  async createOrder(amount: number): Promise<{ id: string; approveUrl: string }> {
    const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    const secret = this.configService.get<string>('PAYPAL_SECRET');
    const environment = this.configService.get<string>('PAYPAL_ENV', 'sandbox');

    const baseUrl =
      environment === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

    if (!clientId || !secret) {
      throw new InternalServerErrorException('Faltan las credenciales de PayPal (PAYPAL_CLIENT_ID o PAYPAL_SECRET) en el archivo .env del servidor');
    }

    const accessToken = await this.getAccessToken(clientId, secret, baseUrl);
    if (!accessToken) {
      throw new InternalServerErrorException('Error de autenticación con PayPal (Verifica las credenciales en el .env)');
    }

    try {
      const response = await axios.post(
        `${baseUrl}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: amount.toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: 'U-Ride',
            landing_page: 'NO_PREFERENCE',
            user_action: 'PAY_NOW',
            return_url: 'https://j0e.site/#/payment-success',
            cancel_url: 'https://j0e.site/#/payment-cancel',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          validateStatus: () => true,
        },
      );

      if (response.status === 200 || response.status === 201) {
        const approveLink = response.data.links.find((link: any) => link.rel === 'approve');
        return {
          id: response.data.id,
          approveUrl: approveLink ? approveLink.href : '',
        };
      }
      
      throw new BadRequestException(`PayPal respondió con error al crear orden: Status ${response.status}`);
    } catch (error) {
      this.logger.error(`Error al crear orden en PayPal: ${error.message}`);
      throw new BadRequestException(`Error al conectar con PayPal para crear orden: ${error.message}`);
    }
  }

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

    // Bypass para demostración/simulación académica de Flutter
    if (orderId && orderId.startsWith('PAY-')) {
      this.logger.log(`[PayPal Bypass] Procesando orden simulada de frontend: ${orderId}`);
      return {
        success: true,
        message: 'Pago completado',
      };
    }

    try {
      // 1. Obtener token de acceso de PayPal
      const accessToken = await this.getAccessToken(clientId, secret, baseUrl);
      if (!accessToken) {
        return {
          success: false,
          message: 'Error de autenticación con PayPal (Verifica tus credenciales en el .env)',
        };
      }

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
