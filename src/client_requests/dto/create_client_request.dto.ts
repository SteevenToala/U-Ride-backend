export class CreateClientRequestDto {

    id_driver: number;
    origin_zone: string;
    destination_zone: string;
    departure_time: Date;
    seats_total: number;
    notes_rules?: string;
}