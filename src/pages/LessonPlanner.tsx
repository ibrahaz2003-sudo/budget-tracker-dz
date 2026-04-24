import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarOff,
  Clock,
  Download,
  FileUp,
  Plus,
  Trash2,
} from 'lucide-react';
import Page from '../components/Page';
import Card from '../components/Card';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Empty from '../components/Empty';
import { Field, Input, Select, Textarea } from '../components/Input';
import { api } from '../lib/api';
import type {
  Absence,
  Holiday,
  Lesson,
  LessonPlan,
  LessonPlanEntry,
  TimetableSlot,
} from '../types';

const LEVELS = ['1AM', '2AM', '3AM', '4AM'];
const SESSION_TYPES: Record<string, string> = {
  theory: 'درس نظري',
  practical: 'أعمال تطبيقية',
  evaluation: 'تقييم',
  remediation: 'معالجة',
  integration: 'إدماج',
};
const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type Tab = 'lessons' | 'timetable' | 'holidays' | 'planner';

export default function LessonPlanner() {
  const [activeTab, setActiveTab] = useState<Tab>('lessons');

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: 'lessons', label: 'الدروس', icon: BookOpen },
    { key: 'timetable', label: 'التوقيت الأسبوعي', icon: Clock },
    { key: 'holidays', label: 'العطل والغيابات', icon: CalendarOff },
    { key: 'planner', label: 'المخطط', icon: Calendar },
  ];

  return (
    <Page
      title="مخطط دروس العلوم الطبيعية"
      description="متابعة يومية وأسبوعية وشهرية لدروس العلوم الطبيعية في المتوسط"
    >
      <div className="flex gap-2 border-b border-slate-200 mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'lessons' && <LessonsTab />}
      {activeTab === 'timetable' && <TimetableTab />}
      {activeTab === 'holidays' && <HolidaysTab />}
      {activeTab === 'planner' && <PlannerTab />}
    </Page>
  );
}

/* ============================================================
   LESSONS TAB
============================================================ */
function LessonsTab() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filterLevel, setFilterLevel] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    const data = filterLevel
      ? await api.listLessonsByLevel(filterLevel)
      : await api.listLessons();
    setLessons(data);
  }, [filterLevel]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    await api.deleteLesson(id);
    load();
  };

  const grouped = lessons.reduce<Record<string, Record<string, Lesson[]>>>((acc, l) => {
    if (!acc[l.field_name]) acc[l.field_name] = {};
    if (!acc[l.field_name][l.chapter]) acc[l.field_name][l.chapter] = [];
    acc[l.field_name][l.chapter].push(l);
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="!w-40">
          <option value="">كل المستويات</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </Select>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} /> إضافة درس
        </Button>
        <Button variant="secondary" onClick={() => setShowImport(true)}>
          <FileUp size={16} /> استيراد من ملف
        </Button>
        <Button variant="secondary" onClick={async () => {
          const json = JSON.stringify(lessons, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lessons-${filterLevel || 'all'}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}>
          <Download size={16} /> تصدير
        </Button>
      </div>

      {lessons.length === 0 ? (
        <Empty
          message="لا توجد دروس. أضف دروسًا أو استورد من ملف JSON."
          action={<Button onClick={() => setShowAdd(true)}><Plus size={16} /> إضافة درس</Button>}
        />
      ) : (
        Object.entries(grouped).map(([fieldName, chapters]) => (
          <Card key={fieldName} title={`ميدان: ${fieldName}`} className="mb-4">
            {Object.entries(chapters).map(([chapter, chLessons]) => (
              <div key={chapter} className="mb-4 last:mb-0">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <BookOpen size={14} className="text-primary-500" />
                  {chapter}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b">
                        <th className="text-right py-2 px-2 font-medium">الدرس</th>
                        <th className="text-right py-2 px-2 font-medium">المستوى</th>
                        <th className="text-right py-2 px-2 font-medium">النوع</th>
                        <th className="text-right py-2 px-2 font-medium">الحصص</th>
                        <th className="text-right py-2 px-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {chLessons.map((lesson) => (
                        <tr key={lesson.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-2">{lesson.title}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                              {lesson.level}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {SESSION_TYPES[lesson.session_type] || lesson.session_type}
                          </td>
                          <td className="py-2 px-2 text-slate-600">{lesson.duration_sessions}</td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => handleDelete(lesson.id)}
                              className="p-1 rounded hover:bg-rose-50 text-rose-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Card>
        ))
      )}

      <AddLessonModal open={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />
      <ImportLessonsModal open={showImport} onClose={() => setShowImport(false)} onSaved={load} />
    </>
  );
}

function AddLessonModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [level, setLevel] = useState('1AM');
  const [fieldName, setFieldName] = useState('');
  const [chapter, setChapter] = useState('');
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState('theory');
  const [duration, setDuration] = useState('1');

  const handleSubmit = async () => {
    if (!fieldName.trim() || !chapter.trim() || !title.trim()) return;
    await api.createLesson({
      level,
      field_name: fieldName.trim(),
      chapter: chapter.trim(),
      title: title.trim(),
      session_type: sessionType,
      duration_sessions: parseInt(duration) || 1,
      sort_order: 0,
    });
    setFieldName('');
    setChapter('');
    setTitle('');
    setDuration('1');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة درس جديد" footer={
      <>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSubmit}>حفظ</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="المستوى">
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
        <Field label="الميدان">
          <Input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="مثال: الإنسان والصحة" />
        </Field>
        <Field label="المحور (الفصل)">
          <Input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="مثال: التغذية عند الإنسان" />
        </Field>
        <Field label="عنوان الدرس">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مصدر الأغذية" />
        </Field>
        <Field label="نوع الحصة">
          <Select value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
            {Object.entries(SESSION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="عدد الحصص" hint="عدد الحصص اللازمة لإتمام هذا الدرس">
          <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ImportLessonsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [importMode, setImportMode] = useState<'json' | 'text'>('json');

  const handleImport = async () => {
    setError('');
    try {
      let parsed: {
        level: string;
        field_name: string;
        chapter: string;
        title: string;
        session_type: string;
        duration_sessions: number;
        sort_order: number;
      }[];

      if (importMode === 'json') {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('يجب أن يكون الملف مصفوفة JSON');
      } else {
        parsed = [];
        const lines = text.split('\n').filter((l) => l.trim());
        let currentLevel = '1AM';
        let currentField = '';
        let currentChapter = '';
        let order = 0;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#المستوى:') || trimmed.startsWith('# المستوى:')) {
            currentLevel = trimmed.split(':')[1].trim();
          } else if (trimmed.startsWith('#الميدان:') || trimmed.startsWith('# الميدان:')) {
            currentField = trimmed.split(':')[1].trim();
          } else if (trimmed.startsWith('#المحور:') || trimmed.startsWith('# المحور:')) {
            currentChapter = trimmed.split(':')[1].trim();
            order = 0;
          } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const title = trimmed.slice(1).trim();
            if (title && currentField && currentChapter) {
              parsed.push({
                level: currentLevel,
                field_name: currentField,
                chapter: currentChapter,
                title,
                session_type: 'theory',
                duration_sessions: 1,
                sort_order: order++,
              });
            }
          }
        }
      }

      if (parsed.length === 0) {
        setError('لم يتم العثور على دروس صالحة');
        return;
      }

      await api.importLessons(parsed);
      setText('');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في تحليل الملف');
    }
  };

  const sampleText = `# المستوى: 1AM
# الميدان: الإنسان والصحة
# المحور: التغذية عند الإنسان
- مصدر الأغذية
- تركيب الأغذية
- دور الأغذية
# المحور: الهضم والامتصاص
- التحول الآلي للأغذية
- التحول الكيميائي للأغذية`;

  const sampleJson = `[
  {
    "level": "1AM",
    "field_name": "الإنسان والصحة",
    "chapter": "التغذية عند الإنسان",
    "title": "مصدر الأغذية",
    "session_type": "theory",
    "duration_sessions": 1,
    "sort_order": 0
  }
]`;

  return (
    <Modal open={open} onClose={onClose} title="استيراد الدروس" maxWidth="max-w-2xl" footer={
      <>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleImport}>استيراد</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="صيغة الاستيراد">
          <Select value={importMode} onChange={(e) => setImportMode(e.target.value as 'json' | 'text')}>
            <option value="text">نص منسق</option>
            <option value="json">JSON</option>
          </Select>
        </Field>
        <Field label="المحتوى" error={error}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={importMode === 'json' ? sampleJson : sampleText}
            className="font-mono text-xs"
          />
        </Field>
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
          <p className="font-semibold mb-1">مثال على صيغة النص المنسق:</p>
          <pre className="whitespace-pre-wrap font-mono text-xs bg-white p-2 rounded border">
            {sampleText}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   TIMETABLE TAB
============================================================ */
function TimetableTab() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setSlots(await api.listTimetable());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    await api.deleteTimetableSlot(id);
    load();
  };

  const slotsByDay = slots.reduce<Record<number, TimetableSlot[]>>((acc, s) => {
    if (!acc[s.day_of_week]) acc[s.day_of_week] = [];
    acc[s.day_of_week].push(s);
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} /> إضافة حصة
        </Button>
      </div>

      {slots.length === 0 ? (
        <Empty
          message="لم يتم إضافة التوقيت الأسبوعي بعد."
          action={<Button onClick={() => setShowAdd(true)}><Plus size={16} /> إضافة حصة</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {[0, 1, 2, 3, 4, 5, 6].filter((d) => slotsByDay[d]).map((day) => (
            <Card key={day} title={DAY_NAMES[day]}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b">
                      <th className="text-right py-2 px-2 font-medium">من</th>
                      <th className="text-right py-2 px-2 font-medium">إلى</th>
                      <th className="text-right py-2 px-2 font-medium">المستوى</th>
                      <th className="text-right py-2 px-2 font-medium">النوع</th>
                      <th className="text-right py-2 px-2 font-medium">القاعة</th>
                      <th className="text-right py-2 px-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotsByDay[day].map((slot) => (
                      <tr key={slot.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-2">{slot.start_time}</td>
                        <td className="py-2 px-2">{slot.end_time}</td>
                        <td className="py-2 px-2">
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                            {slot.level}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {SESSION_TYPES[slot.session_type] || slot.session_type}
                        </td>
                        <td className="py-2 px-2 text-slate-600">{slot.room || '—'}</td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className="p-1 rounded hover:bg-rose-50 text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddSlotModal open={showAdd} onClose={() => setShowAdd(false)} onSaved={load} />
    </>
  );
}

function AddSlotModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [level, setLevel] = useState('1AM');
  const [sessionType, setSessionType] = useState('theory');
  const [room, setRoom] = useState('');

  const handleSubmit = async () => {
    await api.createTimetableSlot({
      day_of_week: parseInt(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      level,
      session_type: sessionType,
      room: room.trim() || null,
    });
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة حصة في التوقيت" footer={
      <>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSubmit}>حفظ</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="اليوم">
          <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من الساعة">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="إلى الساعة">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <Field label="المستوى">
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
        <Field label="نوع الحصة">
          <Select value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
            {Object.entries(SESSION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="القاعة (اختياري)">
          <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="مثال: مخبر 1" />
        </Field>
      </div>
    </Modal>
  );
}

/* ============================================================
   HOLIDAYS & ABSENCES TAB
============================================================ */
function HolidaysTab() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [showAddAbsence, setShowAddAbsence] = useState(false);

  const load = useCallback(async () => {
    const [h, a] = await Promise.all([api.listHolidays(), api.listAbsences()]);
    setHolidays(h);
    setAbsences(a);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seedHolidays = async () => {
    const year = new Date().getFullYear();
    await api.seedAlgerianHolidays(year);
    await api.seedAlgerianHolidays(year + 1);
    load();
  };

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-800">العطل والمناسبات</h3>
            <Button size="sm" onClick={() => setShowAddHoliday(true)}>
              <Plus size={14} />
            </Button>
            <Button size="sm" variant="secondary" onClick={seedHolidays}>
              تحميل عطل الجزائر
            </Button>
          </div>

          {holidays.length === 0 ? (
            <Empty message="لا توجد عطل. اضغط 'تحميل عطل الجزائر' لإضافتها تلقائيًا." />
          ) : (
            <Card>
              <div className="space-y-2 max-h-96 overflow-y-auto scroll-area">
                {holidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{h.name}</p>
                      <p className="text-xs text-slate-500">
                        {h.start_date === h.end_date
                          ? h.start_date
                          : `${h.start_date} → ${h.end_date}`}
                        {h.is_vacation ? (
                          <span className="mr-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                            عطلة مدرسية
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await api.deleteHoliday(h.id);
                        load();
                      }}
                      className="p-1 rounded hover:bg-rose-50 text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-800">أيام الغياب</h3>
            <Button size="sm" onClick={() => setShowAddAbsence(true)}>
              <Plus size={14} />
            </Button>
          </div>

          {absences.length === 0 ? (
            <Empty message="لا توجد أيام غياب مسجلة." />
          ) : (
            <Card>
              <div className="space-y-2 max-h-96 overflow-y-auto scroll-area">
                {absences.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.absence_date}</p>
                      <p className="text-xs text-slate-500">
                        {a.reason || 'بدون سبب'}
                        {a.level && (
                          <span className="mr-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                            {a.level}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await api.deleteAbsence(a.id);
                        load();
                      }}
                      className="p-1 rounded hover:bg-rose-50 text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AddHolidayModal open={showAddHoliday} onClose={() => setShowAddHoliday(false)} onSaved={load} />
      <AddAbsenceModal open={showAddAbsence} onClose={() => setShowAddAbsence(false)} onSaved={load} />
    </>
  );
}

function AddHolidayModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isVacation, setIsVacation] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !startDate || !endDate) return;
    await api.createHoliday({
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      is_vacation: isVacation,
    });
    setName('');
    setStartDate('');
    setEndDate('');
    setIsVacation(false);
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة عطلة / مناسبة" footer={
      <>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSubmit}>حفظ</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="الاسم">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عيد الاستقلال" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من تاريخ">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isVacation}
            onChange={(e) => setIsVacation(e.target.checked)}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-700">عطلة مدرسية (إجازة كاملة)</span>
        </label>
      </div>
    </Modal>
  );
}

function AddAbsenceModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [absenceDate, setAbsenceDate] = useState('');
  const [reason, setReason] = useState('');
  const [level, setLevel] = useState('');

  const handleSubmit = async () => {
    if (!absenceDate) return;
    await api.createAbsence({
      absence_date: absenceDate,
      reason: reason.trim() || null,
      level: level || null,
    });
    setAbsenceDate('');
    setReason('');
    setLevel('');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="تسجيل غياب" footer={
      <>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSubmit}>حفظ</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="التاريخ">
          <Input type="date" value={absenceDate} onChange={(e) => setAbsenceDate(e.target.value)} />
        </Field>
        <Field label="السبب (اختياري)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مرض، إضراب..." />
        </Field>
        <Field label="المستوى المعني (اختياري)" hint="اتركه فارغًا إذا كان الغياب يشمل جميع المستويات">
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">جميع المستويات</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

/* ============================================================
   PLANNER TAB
============================================================ */
function PlannerTab() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  const [entries, setEntries] = useState<LessonPlanEntry[]>([]);

  const load = useCallback(async () => {
    setPlans(await api.listLessonPlans());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const viewPlan = async (plan: LessonPlan) => {
    setSelectedPlan(plan);
    setEntries(await api.getLessonPlanEntries(plan.id));
  };

  const handleDeletePlan = async (id: number) => {
    await api.deleteLessonPlan(id);
    if (selectedPlan?.id === id) {
      setSelectedPlan(null);
      setEntries([]);
    }
    load();
  };

  const toggleEntryStatus = async (entry: LessonPlanEntry) => {
    const newStatus = entry.status === 'completed' ? 'pending' : 'completed';
    await api.updatePlanEntryStatus(entry.id, newStatus);
    if (selectedPlan) {
      setEntries(await api.getLessonPlanEntries(selectedPlan.id));
    }
  };

  const entriesByDate = entries.reduce<Record<string, LessonPlanEntry[]>>((acc, e) => {
    if (!acc[e.scheduled_date]) acc[e.scheduled_date] = [];
    acc[e.scheduled_date].push(e);
    return acc;
  }, {});

  const completedCount = entries.filter((e) => e.status === 'completed').length;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => setShowGenerate(true)}>
          <Plus size={16} /> إنشاء مخطط جديد
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <h3 className="font-semibold text-slate-800 mb-3">المخططات</h3>
          {plans.length === 0 ? (
            <Empty message="لا توجد مخططات. أنشئ مخططًا جديدًا." />
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => viewPlan(plan)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlan?.id === plan.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{plan.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {plan.level} — {plan.plan_type === 'weekly' ? 'أسبوعي' : 'شهري'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {plan.start_date} → {plan.end_date}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlan(plan.id);
                      }}
                      className="p-1 rounded hover:bg-rose-50 text-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          {selectedPlan ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">{selectedPlan.title}</h3>
                {entries.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {completedCount}/{entries.length} حصة مكتملة
                  </span>
                )}
              </div>

              {entries.length > 0 && (
                <div className="mb-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(completedCount / entries.length) * 100}%` }}
                  />
                </div>
              )}

              {entries.length === 0 ? (
                <Empty message="لا توجد حصص في هذا المخطط." />
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto scroll-area">
                  {Object.entries(entriesByDate).map(([date, dateEntries]) => {
                    const dayIndex = new Date(date).getDay();
                    return (
                      <Card key={date} title={`${DAY_NAMES[dayIndex]} — ${date}`}>
                        <div className="space-y-2">
                          {dateEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                                entry.status === 'completed'
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : 'bg-white border-slate-100'
                              }`}
                            >
                              <button
                                onClick={() => toggleEntryStatus(entry)}
                                className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  entry.status === 'completed'
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-slate-300 hover:border-primary-400'
                                }`}
                              >
                                {entry.status === 'completed' && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${
                                  entry.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}>
                                  {entry.lesson_title}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {entry.field_name} — {entry.chapter}
                                </p>
                              </div>
                              <div className="text-left shrink-0">
                                {entry.start_time && (
                                  <p className="text-xs text-slate-500">
                                    {entry.start_time} - {entry.end_time}
                                  </p>
                                )}
                                <p className="text-xs text-slate-400">
                                  {SESSION_TYPES[entry.lesson_session_type] || entry.lesson_session_type}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              اختر مخططًا من القائمة لعرض تفاصيله
            </div>
          )}
        </div>
      </div>

      <GeneratePlanModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onSaved={() => {
          load();
          setShowGenerate(false);
        }}
      />
    </>
  );
}

function GeneratePlanModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [planType, setPlanType] = useState<'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [level, setLevel] = useState('1AM');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (planType === 'weekly' && startDate) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      setEndDate(end.toISOString().slice(0, 10));
    } else if (planType === 'monthly' && startDate) {
      const start = new Date(startDate);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      setEndDate(end.toISOString().slice(0, 10));
    }
  }, [planType, startDate]);

  const handleGenerate = async () => {
    if (!title.trim() || !startDate || !endDate) return;
    setGenerating(true);
    try {
      await api.generateLessonPlan({
        title: title.trim(),
        plan_type: planType,
        start_date: startDate,
        end_date: endDate,
        level,
      });
      setTitle('');
      setStartDate('');
      setEndDate('');
      onSaved();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="إنشاء مخطط جديد" footer={
      <>
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? 'جاري الإنشاء...' : 'إنشاء المخطط'}
        </Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="عنوان المخطط">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: مخطط الأسبوع الأول — جانفي"
          />
        </Field>
        <Field label="نوع المخطط">
          <Select value={planType} onChange={(e) => setPlanType(e.target.value as 'weekly' | 'monthly')}>
            <option value="weekly">أسبوعي</option>
            <option value="monthly">شهري</option>
          </Select>
        </Field>
        <Field label="المستوى">
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ البداية">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="تاريخ النهاية">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          <p className="font-semibold mb-1">ملاحظة:</p>
          <p>سيقوم المخطط بتوزيع الدروس تلقائيًا على الحصص المتاحة في التوقيت الأسبوعي، مع تجاوز أيام العطل والغيابات.</p>
          <p className="mt-1">تأكد من إضافة الدروس والتوقيت الأسبوعي والعطل قبل إنشاء المخطط.</p>
        </div>
      </div>
    </Modal>
  );
}
