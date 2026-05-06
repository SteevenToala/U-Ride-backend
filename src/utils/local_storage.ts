import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Guarda un archivo localmente en la carpeta 'uploads'
 * @param file Objeto Express.Multer.File
 * @param folder Subcarpeta opcional dentro de uploads
 * @returns La URL relativa para acceder al archivo
 */
export const saveLocalFile = async (file: Express.Multer.File, folder: string = 'users'): Promise<string> => {
    try {
        const uploadDir = join(__dirname, '..', '..', 'uploads', folder);
        
        // Crear el directorio si no existe
        if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
        }

        // Generar nombre único para el archivo
        const fileName = `${uuidv4()}${extname(file.originalname)}`;
        const filePath = join(uploadDir, fileName);

        // Guardar el archivo físicamente
        writeFileSync(filePath, file.buffer);

        // Retornar la URL relativa que el frontend usará para acceder al archivo
        // Ej: /uploads/users/uuid.png
        return `/uploads/${folder}/${fileName}`;
    } catch (error) {
        console.error('Error guardando archivo localmente:', error);
        throw error;
    }
}
