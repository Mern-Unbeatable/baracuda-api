export class CategoryService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async createCategory(data) {
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
}
