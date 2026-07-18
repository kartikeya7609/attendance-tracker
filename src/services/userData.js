import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { parseISO, isValid, format, eachDayOfInterval, isWeekend } from "date-fns";
import { db } from "./firebase";

export const NON_ATTENDANCE_STATUSES = ["Class Cancelled", "Postponed", "Holiday", "Pending"];

export function getMedicalLeaveMode(subjectName, subjectSettings = {}) {
    const settings = subjectSettings[subjectName] || {};
    return settings.medicalLeaveMode || "present";
}

export function isRecordCounting(record, subjectSettings = {}) {
    if (NON_ATTENDANCE_STATUSES.includes(record.status)) return false;
    if (record.status === "Medical Leave") {
        const mode = getMedicalLeaveMode(record.subject, subjectSettings);
        return mode !== "exclude";
    }
    return true;
}

export function isRecordPresent(record, subjectSettings = {}) {
    if (record.status === "Present" || record.status === "Late") return true;
    if (record.status === "Medical Leave") {
        const mode = getMedicalLeaveMode(record.subject, subjectSettings);
        return mode === "present";
    }
    return false;
}

// Deprecated back-compat aliases
export function isAttendanceCountingRecord(record) {
    return isRecordCounting(record);
}
export function isPresentRecord(record) {
    return isRecordPresent(record);
}
export function isMedicalLeavePresent(record, subjectSettings = {}) {
    return isRecordPresent(record, subjectSettings);
}
export function isEffectivelyPresent(record, subjectSettings = {}) {
    return isRecordPresent(record, subjectSettings);
}
export function isMedicalLeaveCountingRecord(record) {
    return record.status === "Medical Leave";
}

export async function getUserProfile(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ensureUserProfile(user) {
    const existing = await getUserProfile(user.uid);
    const fallbackSeed = user.displayName || user.email || user.uid;
    if (!existing) {
        // Double check if this user has been deleted/blocked
        const deletedSnap = await getDoc(doc(db, "deleted_users", user.uid));
        if (deletedSnap.exists()) {
            throw new Error("ACCOUNT_DELETED");
        }

        const profile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
            dicebearSeed: fallbackSeed
        };
        await setDoc(doc(db, "users", user.uid), profile, { merge: true });
        return profile;
    }

    if (!existing.dicebearSeed) {
        const updates = { dicebearSeed: existing.dicebearSeed || fallbackSeed };
        await setDoc(doc(db, "users", user.uid), updates, { merge: true });
        return { ...existing, ...updates };
    }

    return existing;
}

export function getDicebearUrl(seed, style = "adventurer") {
    const encodedSeed = encodeURIComponent(seed || "student");
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodedSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export function filterBySemester(records, semesterStartDate, semesterEndDate) {
    let filtered = records;

    if (semesterStartDate) {
        const start = parseISO(semesterStartDate);
        if (isValid(start)) {
            filtered = filtered.filter(record => {
                if (!record.date) return false;
                const recordDate = parseISO(record.date);
                return isValid(recordDate) && recordDate >= start;
            });
        }
    }

    if (semesterEndDate) {
        const end = parseISO(semesterEndDate);
        if (isValid(end)) {
            filtered = filtered.filter(record => {
                if (!record.date) return false;
                const recordDate = parseISO(record.date);
                return isValid(recordDate) && recordDate <= end;
            });
        }
    }

    return filtered;
}

export async function saveSemesterDates(uid, startDate, endDate = null) {
    const updates = { semesterStartDate: startDate };
    if (endDate) {
        updates.semesterEndDate = endDate;
    } else {
        updates.semesterEndDate = null;
    }
    await setDoc(doc(db, "users", uid), updates, { merge: true });
}

export async function getActiveAttendanceRecords(uid, semesterStartDate, semesterEndDate) {
    const attQ = query(collection(db, "attendance_records"), where("uid", "==", uid));
    const attSnap = await getDocs(attQ);
    return filterBySemester(
        attSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        semesterStartDate,
        semesterEndDate
    );
}

export async function getUserHolidays(uid) {
    const holidayQ = query(collection(db, "holidays"), where("uid", "==", uid));
    const holidaySnap = await getDocs(holidayQ);
    return holidaySnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch per-subject settings (e.g. { "SB": { medicalLeaveCountsAsAbsent: true } })
 * stored under users/{uid}/subject_settings/{subjectName}
 */
export async function getSubjectSettings(uid) {
    const q = query(collection(db, "users", uid, "subject_settings"));
    const snap = await getDocs(q);
    const settings = {};
    snap.docs.forEach(d => { settings[d.id] = d.data(); });
    return settings;
}

export async function setSubjectSetting(uid, subjectName, key, value) {
    const ref = doc(db, "users", uid, "subject_settings", subjectName);
    await setDoc(ref, { [key]: value }, { merge: true });
}

/**
 * Build CSV data for attendance report.
 * Returns a CSV string ready for download.
 */
export function buildCSVData(records, subjects, startDate, endDate, holidays, subjectSettings = {}) {
    if (!startDate) return "";

    const start = parseISO(startDate);
    const end   = endDate ? parseISO(endDate) : new Date();

    if (!isValid(start) || !isValid(end)) return "";

    // Build lookup maps
    const recordMap = {};  // "date|subject" → record
    records.forEach(r => {
        const key = `${r.date}|${r.subject}`;
        if (!recordMap[key]) recordMap[key] = r;
    });

    const holidayMap = {};  // "date" → holiday
    holidays.forEach(h => { holidayMap[h.date] = h; });

    // Summary accumulators per subject
    const totals  = {};  // subject → { present: 0, total: 0 }
    subjects.forEach(s => { totals[s] = { present: 0, total: 0 }; });

    // Header row
    const header = ["Date", "Day", "Type", ...subjects];
    const rows   = [header];

    // One row per calendar day
    const allDays = eachDayOfInterval({ start, end });
    allDays.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayName = format(day, "EEEE");
        const weekend  = isWeekend(day);
        const holiday  = holidayMap[dateStr];

        let dayType = "Class Day";
        if (weekend) dayType = dayName;  // "Saturday" / "Sunday"
        else if (holiday) dayType = holiday.reason || holiday.type || "Holiday";

        const row = [dateStr, dayName, dayType];

        subjects.forEach(sub => {
            if (weekend) {
                row.push("WEEKEND");
                return;
            }
            if (holiday && holiday.type !== "Medical Leave") {
                row.push("NC");
                return;
            }

            const key    = `${dateStr}|${sub}`;
            const record = recordMap[key];

            if (!record) {
                row.push("-");
                return;
            }

            const settings = subjectSettings[sub] || {};

            if (record.status === "Present" || record.status === "Late") {
                totals[sub].present += 1;
                totals[sub].total   += 1;
                row.push("P");
            } else if (record.status === "Medical Leave") {
                const mode = getMedicalLeaveMode(sub, subjectSettings);
                if (mode === "present") {
                    totals[sub].present += 1;
                    totals[sub].total   += 1;
                    row.push("MED(P)");
                } else if (mode === "absent") {
                    totals[sub].total   += 1;
                    row.push("MED(A)");
                } else {
                    row.push("MED(NC)");
                }
            } else if (record.status === "Absent") {
                totals[sub].total += 1;
                row.push("A");
            } else if (record.status === "Class Cancelled" || record.status === "Postponed") {
                row.push("NC");
            } else {
                row.push("-");
            }
        });

        rows.push(row);
    });

    // Blank separator
    rows.push(Array(header.length).fill(""));

    // Totals row
    const totalRow = ["TOTAL ATTENDED", "", ""];
    subjects.forEach(sub => {
        const { present, total } = totals[sub];
        totalRow.push(`${present}/${total}`);
    });
    rows.push(totalRow);

    // Percentage row
    const pctRow = ["ATTENDANCE %", "", ""];
    subjects.forEach(sub => {
        const { present, total } = totals[sub];
        pctRow.push(total > 0 ? `${Math.round((present / total) * 100)}%` : "N/A");
    });
    rows.push(pctRow);

    // Convert to CSV string
    return rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
}
