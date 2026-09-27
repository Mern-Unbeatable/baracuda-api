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
   * Create an Album Type
   */
  async createAlbumType(data) {
    try {
      let photoCount = 1;
      if (data.kind === 'SIX') photoCount = 6;
      if (data.kind === 'TWELVE') photoCount = 12;

      const createData = {
        kind: data.kind,
        prizeMoney: data.prizeMoney,
        name: data.name,
        name_pl: data.name_pl || null,
        photoCount
      };
      
      if (data.entryFee !== undefined) createData.entryFee = data.entryFee;
      if (data.isActive !== undefined) createData.isActive = data.isActive;
      if (data.sortOrder !== undefined) createData.sortOrder = data.sortOrder;
      if (data.iconKey !== undefined) createData.iconKey = data.iconKey;

      if (data.description !== undefined) {
        createData.description = data.description;
        createData.description_pl = data.description_pl || null;
      }

      if (data.features !== undefined) {
        const featureList = data.features
          ? data.features.split('\\n').map(f => f.trim()).filter(f => f.length > 0)
          : [];
        const featureListPl = data.features_pl
          ? data.features_pl.split('\\n').map(f => f.trim()).filter(f => f.length > 0)
          : [];
        createData.features = featureList;
        createData.features_pl = featureListPl;
      }

      return await prisma.albumType.create({
        data: createData
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error(`Album Type '${data.kind}' already exists.`);
      }
      // Provide a clean error message instead of raw Prisma errors
      throw new Error('Failed to create Album Type. Please check if all required fields are valid.');
    }
  }

  /**
   * Update an Album Type
   */
  async updateAlbumType(id, data) {
    try {
      // Data contains strings for name, description, and features from the API.
      const updateData = {
        prizeMoney: data.prizeMoney
      };

      if (data.entryFee !== undefined) updateData.entryFee = data.entryFee;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      if (data.iconKey !== undefined) updateData.iconKey = data.iconKey;

      if (data.name) {
        updateData.name = data.name;
        updateData.name_pl = data.name_pl || null;
      }
      
      if (data.description !== undefined) {
        updateData.description = data.description;
        updateData.description_pl = data.description_pl || null;
      }

      // 'features' in the DB is now String[]
      // If the client sends a multi-line string, we can split it by newline
      if (data.features !== undefined) {
        const featureList = data.features
          ? data.features.split('\\n').map(f => f.trim()).filter(f => f.length > 0)
          : [];
        const featureListPl = data.features_pl
          ? data.features_pl.split('\\n').map(f => f.trim()).filter(f => f.length > 0)
          : [];
        updateData.features = featureList;
        updateData.features_pl = featureListPl;
      }

      return await prisma.albumType.update({
        where: { id },
        data: updateData
      });
    } catch (error) {
      throw new Error('Failed to update album type: ' + error.message);
    }
  }

  /**
   * Delete an Album Type
   */
  async deleteAlbumType(id) {
    try {
      return await prisma.albumType.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error('Failed to delete album type: ' + error.message);
    }
  }
}
