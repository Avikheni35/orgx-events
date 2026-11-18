import mongoose from 'mongoose';
import { connectDB } from '../config/db';

(async () => {
  await connectDB();
  const result = await mongoose.connection.collection('staffprofiles').deleteMany({ email: 'thomas.mueller@neulogistik2.de' });
  console.log('Deleted StaffProfiles:', result.deletedCount);
  await mongoose.disconnect();
})();
