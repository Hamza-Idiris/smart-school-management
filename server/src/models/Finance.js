import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    month: { type: String, required: true }, // YYYY-MM
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'waived'],
      default: 'unpaid',
      index: true,
    },
    feeTagSnapshot: { type: String },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ schoolId: 1, studentId: 1, month: 1 }, { unique: true });

export const Invoice = mongoose.model('Invoice', invoiceSchema);

const paymentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'mobile_money', 'card'], required: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNumber: { type: String, required: true, unique: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
