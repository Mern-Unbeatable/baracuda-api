export const PaginationUtil = {
  /**
   * Generates pagination metadata
   * @param {number} totalRecords - Total number of records in the database
   * @param {number} page - Current page number
   * @param {number} limit - Number of records per page
   * @returns {Object} Pagination metadata object
   */
  getMetadata: (totalRecords, page = 1, limit = 10) => {
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const currentPage = Number(page);
    
    return {
      currentPage,
      totalPages,
      totalRecords,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1
    };
  },

  /**
   * Parses page and limit from request query, providing safe defaults
   * @param {Object} query - Express request query object
   * @returns {Object} { skip, take, page, limit }
   */
  getPaginationOptions: (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, parseInt(query.limit) || 10);
    const skip = (page - 1) * limit;

    return {
      skip,
      take: limit,
      page,
      limit
    };
  }
};
