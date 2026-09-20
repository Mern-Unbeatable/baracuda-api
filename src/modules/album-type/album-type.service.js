import prisma from '../../config/prisma.js';

export class AlbumTypeService {
  /**
   * Get all album types
   */
  async getAllAlbumTypes() {
    try {
      return await prisma.albumType.findMany({
        orderBy: { sortOrder: 'asc' }
      });
    } catch (error) {
      throw new Error('Failed to fetch album types: ' + error.message);
    }
  }

  /**
   * Update an Album Type
   */
  async updateAlbumType(id, data) {
    try {
      // Data contains strings for name, description, and features from the API.
      // We need to convert them to JSON format like {"en": "string"}
      
      const updateData = {
        prizeMoney: data.prizeMoney
      };

      if (data.name) {
        updateData.name = { en: data.name };
      }
      
      if (data.description !== undefined) {
        updateData.description = { en: data.description };
      }

      // 'features' in the DB is usually {"en": ["feature 1", "feature 2"]}
      // If the client sends a multi-line string, we can split it by newline
      if (data.features !== undefined) {
        const featureList = data.features
          ? data.features.split('\\n').map(f => f.trim()).filter(f => f.length > 0)
          : [];
        updateData.features = { en: featureList, cy: [] };
      }

      return await prisma.albumType.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      throw new Error('Failed to update album type: ' + error.message);
    }
  }
}
