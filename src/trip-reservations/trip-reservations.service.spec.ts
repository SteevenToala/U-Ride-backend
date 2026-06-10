import { Test, TestingModule } from '@nestjs/testing';
import { TripReservationsService } from './trip-reservations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TripReservation } from './entities/trip-reservation.entity';
import { SharedTrip } from '../shared-trips/entities/shared-trip.entity';
import { PaypalService } from './paypal.service';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TripReservationsService (Unit Tests)', () => {
  let service: TripReservationsService;
  let reservationRepo: Repository<TripReservation>;
  let tripRepo: Repository<SharedTrip>;
  let paypalService: PaypalService;

  const mockReservationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockTripRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockPaypalService = {
    verifyOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripReservationsService,
        {
          provide: getRepositoryToken(TripReservation),
          useValue: mockReservationRepo,
        },
        {
          provide: getRepositoryToken(SharedTrip),
          useValue: mockTripRepo,
        },
        {
          provide: PaypalService,
          useValue: mockPaypalService,
        },
      ],
    }).compile();

    service = module.get<TripReservationsService>(TripReservationsService);
    reservationRepo = module.get<Repository<TripReservation>>(getRepositoryToken(TripReservation));
    tripRepo = module.get<Repository<SharedTrip>>(getRepositoryToken(SharedTrip));
    paypalService = module.get<PaypalService>(PaypalService);

    jest.clearAllMocks();
  });

  describe('create - Solicitud de Reserva (RF-005)', () => {
    const mockTrip = {
      id: 1,
      id_driver: 10,
      origin: 'Ficoa',
      destination: 'Campus Huachi',
      available_seats: 3,
      price: 0.50,
      status: 'PENDING',
    };

    it('debe lanzar NotFoundException si el viaje no existe', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({ id_trip: 999, id_passenger: 2 }),
      ).rejects.toThrow(new NotFoundException('Trip not found'));
    });

    it('debe lanzar BadRequestException si el conductor intenta reservar su propio viaje', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(mockTrip);

      await expect(
        service.create({ id_trip: 1, id_passenger: 10 }), // Pasajero es el mismo conductor (10)
      ).rejects.toThrow(new BadRequestException('El conductor no puede reservar su propio viaje'));
    });

    it('debe lanzar BadRequestException si no hay suficientes asientos disponibles', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(mockTrip);

      await expect(
        service.create({ id_trip: 1, id_passenger: 2, seats_requested: 5 }), // Pide 5, hay 3
      ).rejects.toThrow(new BadRequestException('Not enough available seats'));
    });

    it('debe reservar con éxito en EFECTIVO por defecto (Caso Positivo)', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(mockTrip);
      
      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        message: 'Llevo maleta',
      };

      const expectedReservation = {
        ...reservationPayload,
        payment_method: 'EFECTIVO',
        payment_status: 'PENDIENTE',
        paypal_order_id: null,
      };

      mockReservationRepo.create.mockReturnValue(expectedReservation);
      mockReservationRepo.save.mockResolvedValue(expectedReservation);

      const result = await service.create(reservationPayload);

      expect(result.payment_method).toBe('EFECTIVO');
      expect(result.payment_status).toBe('PENDIENTE');
      expect(mockReservationRepo.save).toHaveBeenCalled();
    });

    it('debe reservar con éxito usando PAYPAL si se provee una orden válida (Caso Positivo)', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(mockTrip);
      mockPaypalService.verifyOrder.mockResolvedValueOnce({ success: true, message: 'Pago completado' });

      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        payment_method: 'PAYPAL',
        paypal_order_id: 'ORDER-PAYPAL-123',
      };

      const expectedReservation = {
        ...reservationPayload,
        payment_status: 'PAGADO',
      };

      mockReservationRepo.create.mockReturnValue(expectedReservation);
      mockReservationRepo.save.mockResolvedValue(expectedReservation);

      const result = await service.create(reservationPayload);

      expect(result.payment_method).toBe('PAYPAL');
      expect(result.payment_status).toBe('PAGADO');
      expect(result.paypal_order_id).toBe('ORDER-PAYPAL-123');
      expect(mockPaypalService.verifyOrder).toHaveBeenCalledWith('ORDER-PAYPAL-123');
      expect(mockReservationRepo.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException en PAYPAL si falta el paypal_order_id', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(mockTrip);

      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        payment_method: 'PAYPAL', // Falta paypal_order_id
      };

      await expect(service.create(reservationPayload)).rejects.toThrow(
        new BadRequestException('Falta el identificador de la orden de PayPal'),
      );
    });

    it('debe lanzar BadRequestException en PAYPAL si la verificación de la orden falla', async () => {
      mockTripRepo.findOne.mockResolvedValueOnce(mockTrip);
      mockPaypalService.verifyOrder.mockResolvedValueOnce({
        success: false,
        message: 'El pago no fue completado en PayPal.',
      });

      const reservationPayload = {
        id_trip: 1,
        id_passenger: 2,
        seats_requested: 1,
        payment_method: 'PAYPAL',
        paypal_order_id: 'INVALID-ORDER',
      };

      await expect(service.create(reservationPayload)).rejects.toThrow(
        new BadRequestException('El pago no fue completado en PayPal.'),
      );
    });
  });
});
