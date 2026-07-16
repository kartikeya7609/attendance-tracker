import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, Timestamp, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";

export const addNotification = async (uid, notification) => {
    try {
        await addDoc(collection(db, "notifications"), {
            uid,
            title: notification.title,
            body: notification.body,
            category: notification.category, // reminders, timetable, warnings, announcements, sharing, feedback
            read: false,
            timestamp: Timestamp.now(),
            actions: notification.actions || null,
            classData: notification.classData || null
        });
    } catch (err) {
        console.error("Failed to add notification:", err);
    }
};

export const checkAndTriggerAttendanceWarning = async (uid, percentage, stats) => {
    try {
        if (percentage < 75 && percentage > 0) {
            // Calculate how many classes needed to reach 75%
            // present / total = 0.75 => (present + x) / (total + x) = 0.75 => present + x = 0.75*total + 0.75*x => 0.25*x = 0.75*total - present => x = 3*total - 4*present
            const needed = Math.max(0, 3 * stats.total - 4 * stats.present);
            
            // Check if warning already triggered today
            const todayStr = new Date().toISOString().slice(0, 10);
            const q = query(
                collection(db, "notifications"),
                where("uid", "==", uid),
                where("category", "==", "warnings")
            );
            const snap = await getDocs(q);
            const alreadySentToday = snap.docs.some(docSnapshot => {
                const date = docSnapshot.data().timestamp?.toDate()?.toISOString().slice(0, 10);
                return date === todayStr;
            });

            if (!alreadySentToday) {
                await addNotification(uid, {
                    title: "⚠️ Attendance Warning",
                    body: `Your attendance is now ${percentage}%. You need to attend ${needed} more classes to reach 75%.`,
                    category: "warnings"
                });
            }
        }
    } catch (err) {
        console.error("Error triggering warning:", err);
    }
};

export const triggerDailyTimetableNotification = async (uid, schedule, dateStr) => {
    if (!schedule || schedule.length === 0) return;
    try {
        const classNames = schedule.map(c => `• ${c.subject}`).join("\n");
        await addNotification(uid, {
            title: "Good Morning! Today's Classes:",
            body: `Here are your classes for today:\n${classNames}\nHave a productive day!`,
            category: "timetable"
        });
    } catch (err) {
        console.error("Error triggering daily notification:", err);
    }
};
