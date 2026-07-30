import { Student } from '../models/Student.js';
import { AttendanceSession } from '../models/AttendanceSession.js';
import { TeacherCheckIn } from '../models/TeacherCheckIn.js';
import { User } from '../models/User.js';
import { Invoice } from '../models/Finance.js';
import { Gradebook } from '../models/Gradebook.js';
import { asyncHandler } from '../middleware/error.js';
import { dashboardBus } from '../services/dashboardBus.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function rate(presentLike, total) {
  if (!total) return 0;
  return Math.round((presentLike / total) * 1000) / 10;
}

async function buildKpis(schoolId) {
  const date = todayIso();

  const [enrollment, teachers, sessions, checkIns, unexcusedSessions, outstanding, gradebooks] =
    await Promise.all([
      Student.countDocuments({ schoolId, status: 'active' }),
      User.countDocuments({ schoolId, role: 'teacher', status: 'active' }),
      AttendanceSession.find({ schoolId, date }),
      TeacherCheckIn.find({ schoolId, date }),
      AttendanceSession.find({
        schoolId,
        date,
        'marks.status': { $in: ['absent', 'truant'] },
      }),
      Invoice.aggregate([
        { $match: { schoolId, status: { $in: ['unpaid', 'partial'] } } },
        {
          $group: {
            _id: null,
            outstanding: { $sum: { $subtract: ['$amountDue', '$amountPaid'] } },
            collected: { $sum: '$amountPaid' },
          },
        },
      ]),
      Gradebook.aggregate([
        { $match: { schoolId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

  function slotStats(slot) {
    const slotSessions = sessions.filter((s) => s.slot === slot);
    let present = 0;
    let absent = 0;
    let late = 0;
    let truant = 0;
    let excused = 0;
    let total = 0;
    for (const session of slotSessions) {
      for (const mark of session.marks) {
        total += 1;
        if (mark.status === 'present') present += 1;
        else if (mark.status === 'late') late += 1;
        else if (mark.status === 'absent') absent += 1;
        else if (mark.status === 'truant') truant += 1;
        else if (mark.status === 'excused') excused += 1;
      }
    }
    const presentLike = present + late;
    return {
      present,
      late,
      absent,
      truant,
      excused,
      total,
      percent: rate(presentLike, total),
      sessions: slotSessions.length,
    };
  }

  let unexcused = 0;
  for (const session of unexcusedSessions) {
    unexcused += session.marks.filter((m) => m.status === 'absent' || m.status === 'truant').length;
  }

  const lateTeachers = checkIns.filter((c) => c.isLate).length;
  const onTimeTeachers = checkIns.filter((c) => !c.isLate).length;

  const finance = outstanding[0] || { outstanding: 0, collected: 0 };
  const gradeMap = Object.fromEntries(gradebooks.map((g) => [g._id, g.count]));

  return {
    date,
    enrollment,
    slot1: slotStats(1),
    slot2: slotStats(2),
    teachers: {
      total: teachers,
      checkedIn: checkIns.length,
      onTime: onTimeTeachers,
      late: lateTeachers,
      missing: Math.max(teachers - checkIns.length, 0),
    },
    unexcusedAbsences: unexcused,
    finance: {
      collected: finance.collected || 0,
      outstanding: finance.outstanding || 0,
    },
    academics: {
      draft: gradeMap.draft || 0,
      locked: gradeMap.locked || 0,
      released: gradeMap.released || 0,
    },
  };
}

export const getKpis = asyncHandler(async (req, res) => {
  const data = await buildKpis(req.user.schoolId);
  res.json({ success: true, data });
});

export const streamKpis = asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const schoolId = req.user.schoolId.toString();

  const send = async () => {
    try {
      const data = await buildKpis(req.user.schoolId);
      res.write(`event: kpis\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  };

  await send();

  const onNotify = (payload) => {
    if (payload.schoolId === schoolId) {
      void send();
    }
  };
  dashboardBus.on('kpi', onNotify);

  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    dashboardBus.off('kpi', onNotify);
  });
});
