import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DriversPosition } from './drivers_position.entity';
import { Repository } from 'typeorm';
import { CreateDriverPositionDto } from './dto/create_driver_position.dto';

@Injectable()
export class DriversPositionService {

    constructor(
        @InjectRepository(DriversPosition) private driversPositionRepository: Repository<DriversPosition>
    ) {}

    async create(driverPosition: CreateDriverPositionDto) {
        try {
            if (!driverPosition.id_driver) {
                console.log('Error: id_driver es undefined');
                return false;
            }
            const data = await this.driversPositionRepository.query(`
                SELECT 
                    *
                FROM
                    drivers_position
                WHERE
                    id_driver = ?
            `, [driverPosition.id_driver]);            
            if (data.length <= 0) {
                const newPosition = await this.driversPositionRepository.query(`
                    INSERT INTO 
                        drivers_position(id_driver, position)
                    VALUES(
                        ?,
                        ST_GeomFromText(?, 4326)
                    )
                `, [driverPosition.id_driver, `POINT(${driverPosition.lat} ${driverPosition.lng})`]);
            }
            else {
                const newPosition = await this.driversPositionRepository.query(`
                    UPDATE
                        drivers_position
                    SET
                        position = ST_GeomFromText(?, 4326)
                    WHERE
                        id_driver = ?
                `, [`POINT(${driverPosition.lat} ${driverPosition.lng})`, driverPosition.id_driver]);
            }
            return true;    
        } catch (error) {
            console.log('Error creando la posicion del conductor', error);
            return false;    
        }
    }

    async getDriverPosition(id_driver: number) {
        if (!id_driver) return null;
        const driverPosition = await this.driversPositionRepository.query(`
        SELECT
            *
        FROM
            drivers_position
        WHERE
            id_driver = ?
        `, [id_driver]);
        if (driverPosition.length <= 0) return null;
        return {
            'id_driver': driverPosition[0].id_driver,
            'lat': driverPosition[0].position.y,
            'lng': driverPosition[0].position.x,
        };
    }

    async getNearbyDrivers(client_lat: number, client_lng: number) {
        const driversPosition = await this.driversPositionRepository.query(`
            SELECT
                id_driver,
                position,
                ST_Distance_Sphere(position, ST_GeomFromText(?, 4326)) AS distance
            FROM
                drivers_position
            HAVING distance <= 5000
        `, [`POINT(${client_lat} ${client_lng})`]);
        return driversPosition;
    }

    delete(id_driver: number) {
        return this.driversPositionRepository.delete(id_driver);
    }

}
