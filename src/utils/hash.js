import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export class HashUtil {
  static async hash(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async compare(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
}
