import { TranslateUtil } from '../../utils/translate.js';

export class CategoryService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async createCategory(data, sourceLang = 'en') {
    // TRANSLATION LOGIC FOR STRING FIELDS
    if (data.name) {
      if (sourceLang === 'pl') {
        data.name_pl = data.name;
        data.name = await TranslateUtil.translateText(data.name, 'en', 'pl');
      } else {
        data.name_pl = await TranslateUtil.translateText(data.name, 'pl', 'en');
      }
    }

    if (data.description) {
      if (sourceLang === 'pl') {
        data.description_pl = data.description;
        data.description = await TranslateUtil.translateText(data.description, 'en', 'pl');
      } else {
        data.description_pl = await TranslateUtil.translateText(data.description, 'pl', 'en');
      }
    }

    // Ensure slug is unique
    const existing = await this.prisma.category.findUnique({
      where: { slug: data.slug }
    });

    if (existing) {
      throw new Error(`Category with slug '${data.slug}' already exists`);
    }

    // If parentId is provided, ensure parent exists
    if (data.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: data.parentId }
      });
      if (!parent) {
        throw new Error('Parent category not found');
      }
    }

    return this.prisma.category.create({
      data
    });
  }

  async getAllCategories() {
    // Fetch all top-level categories (no parentId) along with their nested subcategories
    return this.prisma.category.findMany({
      where: {
        parentId: null
      },
      include: {
        subcategories: {
          orderBy: {
            sortOrder: 'asc'
          }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });
  }

  async deleteCategory(id) {
    const existing = await this.prisma.category.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new Error('Category not found');
    }

    return this.prisma.category.delete({
      where: { id }
    });
  }
}
