import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientRequests, Status } from './client_requests.entity';
import { CreateClientRequestDto } from './dto/create_client_request.dto';
import { UpdateDriverAssignedClientRequestDto } from './dto/update_driver_assigned_client_request.dto';
import { UpdateStatusClientRequestDto } from './dto/update_status_client_request.dto';
import { DriverTripOffers, JoinRequestStatus } from 'src/driver_trip_offers/driver_trip_offers.entity';
import { User } from 'src/users/user.entity';
import { AuditLogsService } from 'src/audit_logs/audit_logs.service';

@Injectable()
export class ClientRequestsService {
  constructor(
    @InjectRepository(ClientRequests) private clientRequestsRepository: Repository<ClientRequests>,
    @InjectRepository(DriverTripOffers) private joinRequestsRepository: Repository<DriverTripOffers>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(clientRequest: CreateClientRequestDto) {
    const driver = await this.usersRepository.findOneBy({ id: clientRequest.id_driver });

    if (!driver) {
      throw new HttpException('Conductor no encontrado', HttpStatus.NOT_FOUND);
    }

    if (driver.is_suspended && (!driver.suspended_until || driver.suspended_until > new Date())) {
      throw new HttpException('Conductor suspendido temporalmente', HttpStatus.FORBIDDEN);
    }

    if (clientRequest.seats_total < 1) {
      throw new HttpException('Los cupos deben ser mayores a cero', HttpStatus.BAD_REQUEST);
    }

    const newTrip = this.clientRequestsRepository.create({
      ...clientRequest,
      seats_available: clientRequest.seats_total,
      status: Status.PUBLISHED,
      security_rules_visible: true,
    });

    const tripSaved = await this.clientRequestsRepository.save(newTrip);
    await this.auditLogsService.log(clientRequest.id_driver, 'TRIP_PUBLISHED', `trip:${tripSaved.id}`);
    return tripSaved;
  }

  async searchTrips(filters: {
    origin_zone?: string;
    destination_zone?: string;
    date?: string;
    available_only?: string;
  }) {
    const query = this.clientRequestsRepository
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.driver', 'driver')
      .where('trip.status = :status', { status: Status.PUBLISHED });

    if (filters.origin_zone) {
      query.andWhere('trip.origin_zone LIKE :origin', { origin: `%${filters.origin_zone}%` });
    }

    if (filters.destination_zone) {
      query.andWhere('trip.destination_zone LIKE :destination', { destination: `%${filters.destination_zone}%` });
    }

    if (filters.date) {
      query.andWhere('DATE(trip.departure_time) = :date', { date: filters.date });
    }

    if (filters.available_only === 'true') {
      query.andWhere('trip.seats_available > 0');
    }

    return query.orderBy('trip.departure_time', 'ASC').getMany();
  }

  async requestJoin(id_trip: number, id_passenger: number, message?: string) {
    const trip = await this.clientRequestsRepository.findOneBy({ id: id_trip });
    if (!trip) {
      throw new HttpException('Viaje no encontrado', HttpStatus.NOT_FOUND);
    }

    if (trip.status !== Status.PUBLISHED) {
      throw new HttpException('El viaje no esta disponible', HttpStatus.BAD_REQUEST);
    }

    if (trip.id_driver === id_passenger) {
      throw new HttpException('No puedes solicitar tu propio viaje', HttpStatus.BAD_REQUEST);
    }

    const alreadyExists = await this.joinRequestsRepository.findOne({
      where: {
        id_trip,
        id_passenger,
      },
    });

    if (alreadyExists && alreadyExists.status !== JoinRequestStatus.REJECTED) {
      throw new HttpException('Ya existe una solicitud activa para este viaje', HttpStatus.CONFLICT);
    }

    const joinRequest = this.joinRequestsRepository.create({
      id_trip,
      id_passenger,
      message,
      status: JoinRequestStatus.PENDING,
    });

    const joinRequestSaved = await this.joinRequestsRepository.save(joinRequest);
    await this.auditLogsService.log(id_passenger, 'JOIN_REQUEST_CREATED', `trip:${id_trip}`);
    return joinRequestSaved;
  }

  async updateDriverAssigned(id_trip: number, id_driver: number, data: UpdateDriverAssignedClientRequestDto) {
    const trip = await this.clientRequestsRepository.findOneBy({ id: id_trip });
    if (!trip || trip.id_driver !== id_driver) {
      throw new HttpException('No autorizado para gestionar solicitudes', HttpStatus.FORBIDDEN);
    }

    const joinRequest = await this.joinRequestsRepository.findOneBy({ id: data.id_join_request, id_trip });
    if (!joinRequest) {
      throw new HttpException('Solicitud no encontrada', HttpStatus.NOT_FOUND);
    }

    joinRequest.status = data.decision === 'ACCEPTED' ? JoinRequestStatus.ACCEPTED : JoinRequestStatus.REJECTED;
    const updated = await this.joinRequestsRepository.save(joinRequest);
    await this.auditLogsService.log(id_driver, 'JOIN_REQUEST_DECIDED', `trip:${id_trip};request:${joinRequest.id};status:${joinRequest.status}`);
    return updated;
  }

  async confirmParticipation(id_trip: number, id_driver: number, id_join_request: number) {
    const trip = await this.clientRequestsRepository.findOneBy({ id: id_trip });
    if (!trip || trip.id_driver !== id_driver) {
      throw new HttpException('No autorizado para confirmar participantes', HttpStatus.FORBIDDEN);
    }

    if (trip.seats_available <= 0) {
      throw new HttpException('No hay cupos disponibles', HttpStatus.BAD_REQUEST);
    }

    const joinRequest = await this.joinRequestsRepository.findOneBy({ id: id_join_request, id_trip });
    if (!joinRequest || joinRequest.status !== JoinRequestStatus.ACCEPTED) {
      throw new HttpException('La solicitud debe estar aceptada para confirmar', HttpStatus.BAD_REQUEST);
    }

    joinRequest.status = JoinRequestStatus.CONFIRMED;
    trip.seats_available -= 1;
    trip.confirmed_passengers += 1;

    await this.clientRequestsRepository.save(trip);
    const confirmed = await this.joinRequestsRepository.save(joinRequest);
    await this.auditLogsService.log(id_driver, 'PARTICIPATION_CONFIRMED', `trip:${id_trip};request:${id_join_request}`);
    return confirmed;
  }

  async updateStatus(id_driver: number, updateStatusDto: UpdateStatusClientRequestDto) {
    const trip = await this.clientRequestsRepository.findOneBy({ id: updateStatusDto.id_trip });
    if (!trip || trip.id_driver !== id_driver) {
      throw new HttpException('No autorizado para actualizar el estado', HttpStatus.FORBIDDEN);
    }

    trip.status = updateStatusDto.status;
    const updatedTrip = await this.clientRequestsRepository.save(trip);
    await this.auditLogsService.log(id_driver, 'TRIP_STATUS_UPDATED', `trip:${updateStatusDto.id_trip};status:${updateStatusDto.status}`);
    return updatedTrip;
  }

  async rateTrip(params: {
    id_trip: number;
    from_user_id: number;
    to_user_id: number;
    rating: number;
    review?: string;
  }) {
    const trip = await this.clientRequestsRepository.findOneBy({ id: params.id_trip });
    if (!trip || trip.status !== Status.FINISHED) {
      throw new HttpException('Solo se puede calificar viajes finalizados', HttpStatus.BAD_REQUEST);
    }

    const joinRequest = await this.joinRequestsRepository.findOneBy({
      id_trip: params.id_trip,
      id_passenger: trip.id_driver === params.from_user_id ? params.to_user_id : params.from_user_id,
    });

    if (!joinRequest || joinRequest.status !== JoinRequestStatus.CONFIRMED) {
      throw new HttpException('No existe participacion confirmada para calificar', HttpStatus.BAD_REQUEST);
    }

    if (trip.id_driver === params.to_user_id) {
      joinRequest.passenger_rating_to_driver = params.rating;
      joinRequest.passenger_review_to_driver = params.review;
    } else {
      joinRequest.driver_rating_to_passenger = params.rating;
      joinRequest.driver_review_to_passenger = params.review;
    }

    await this.joinRequestsRepository.save(joinRequest);

    const userToRate = await this.usersRepository.findOneBy({ id: params.to_user_id });
    if (!userToRate) {
      throw new HttpException('Usuario calificado no encontrado', HttpStatus.NOT_FOUND);
    }

    const newCount = userToRate.reputation_count + 1;
    const newAverage = ((Number(userToRate.reputation_average) * userToRate.reputation_count) + params.rating) / newCount;
    userToRate.reputation_count = newCount;
    userToRate.reputation_average = Number(newAverage.toFixed(2));
    await this.usersRepository.save(userToRate);
    await this.auditLogsService.log(params.from_user_id, 'TRIP_REVIEW_CREATED', `trip:${params.id_trip};to:${params.to_user_id};rating:${params.rating}`);

    return joinRequest;
  }

  getSafetyRules() {
    return [
      'Respeta horarios y punto de encuentro acordado por zona.',
      'No compartas datos sensibles fuera de la app.',
      'Manten comunicacion clara y trato respetuoso.',
      'Reporta conductas indebidas inmediatamente.',
      'Confirma asistencia con anticipacion para no bloquear cupos.',
    ];
  }

  getByClientRequest(id_trip: number) {
    return this.clientRequestsRepository.findOne({
      where: { id: id_trip },
      relations: ['driver'],
    });
  }

  getByDriverAssigned(id_driver: number) {
    return this.clientRequestsRepository.find({
      where: { id_driver },
      relations: ['driver'],
      order: { departure_time: 'DESC' },
    });
  }

  async getByClientAssigned(id_passenger: number) {
    const requests = await this.joinRequestsRepository.find({
      where: { id_passenger },
      relations: ['trip', 'trip.driver'],
      order: { created_at: 'DESC' },
    });

    return requests.map((request) => ({
      request,
      trip: request.trip,
    }));
  }

  async getNearbyTripRequest(_driver_lat: number, _driver_lng: number) {
    return this.clientRequestsRepository.find({
      where: { status: Status.PUBLISHED },
      relations: ['driver'],
      order: { departure_time: 'ASC' },
    });
  }
}
