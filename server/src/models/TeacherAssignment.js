import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    academicYear: { type: String, required: true },
  },
  { timestamps: true }
);

assignmentSchema.index(
  { schoolId: 1, teacherId: 1, classId: 1, subjectId: 1, academicYear: 1 },
  { unique: true }
);

export const TeacherAssignment = mongoose.model('TeacherAssignment', assignmentSchema);
