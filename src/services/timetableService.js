
import { db } from "./firebase";
import { collection, addDoc, updateDoc, arrayUnion, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

export const createTimetable = async (user, timetableData) => {
    let unique = false;
    let code = "";

    while (!unique) {
        code = generateCode();
        const q = query(collection(db, "public_timetables"), where("code", "==", code));
        const snapshot = await getDocs(q);
        if (snapshot.empty) unique = true;
    }

    const newTimetable = {
        ...timetableData,
        code,
        creatorUid: user.uid,
        creatorName: user.displayName || user.email.split('@')[0],
        createdAt: Timestamp.now(),
        attendees: [user.uid] 
    };

    const docRef = await addDoc(collection(db, "public_timetables"), newTimetable);

    await joinTimetable(user.uid, code);

    return { id: docRef.id, code };
};

export const joinTimetable = async (uid, code) => {

    const q = query(collection(db, "public_timetables"), where("code", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error("Timetable not found");

    const timetableDoc = snapshot.docs[0];
    const timetableId = timetableDoc.id;
    const timetableData = timetableDoc.data();

    const joinRef = doc(db, "users", uid, "joined_timetables", timetableId);
    const joinSnap = await getDoc(joinRef);

    if (!joinSnap.exists() || (joinSnap.exists() && joinSnap.data().deleted)) {
        await setDoc(joinRef, {
            timetableId: timetableId,
            code: code,
            name: timetableData.name,
            joinedAt: Timestamp.now()
        });

        // Set semesterStartDate to today on join
        const todayStr = new Date().toISOString().slice(0, 10);
        await setDoc(doc(db, "users", uid), { semesterStartDate: todayStr }, { merge: true });

        await updateDoc(doc(db, "public_timetables", timetableId), {
            attendees: arrayUnion(uid)
        });

        const subjectsToAdd = new Set();
        if (timetableData.schedule) {
            Object.values(timetableData.schedule).forEach(daySchedule => {
                daySchedule.forEach(slot => {
                    if (slot.subject && slot.subject !== "" &&
                        slot.subject !== "Break" &&
                        slot.subject !== "Free" &&
                        slot.subject !== "Break / Lunch" &&
                        slot.subject !== "Free Period") {
                        subjectsToAdd.add(slot.subject);
                    }
                });
            });
        }

        for (const subjectName of subjectsToAdd) {

            const subQ = query(
                collection(db, "subjects"),
                where("uid", "==", uid),
                where("name", "==", subjectName)
            );
            const subSnap = await getDocs(subQ);

            if (subSnap.empty) {
                await addDoc(collection(db, "subjects"), {
                    uid: uid,
                    name: subjectName,
                    createdAt: new Date().toISOString(),
                    fromTimetable: timetableId 
                });
            }
        }
    }

    return timetableData;
};

export const leaveTimetable = async (uid, timetableId) => {

    const joinRef = doc(db, "users", uid, "joined_timetables", timetableId);
    const joinSnap = await getDoc(joinRef);

    if (joinSnap.exists()) {
        await setDoc(joinRef, {}); 
        await updateDoc(joinRef, { deleted: true }); 

        const timetableRef = doc(db, "public_timetables", timetableId);
        const timetableSnap = await getDoc(timetableRef);

        if (timetableSnap.exists()) {
            const currentAttendees = timetableSnap.data().attendees || [];
            const updatedAttendees = currentAttendees.filter(id => id !== uid);
            await updateDoc(timetableRef, {
                attendees: updatedAttendees
            });
        }
    }
};

export const getAllTimetables = async () => {
    const q = query(collection(db, "public_timetables"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getUserTimetables = async (uid) => {
    const q = query(collection(db, "users", uid, "joined_timetables"));
    const snapshot = await getDocs(q);
    const joined = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(j => !j.deleted); 

    const timetables = [];
    for (const j of joined) {
        const tDoc = await getDoc(doc(db, "public_timetables", j.timetableId));
        if (tDoc.exists()) {
            timetables.push({ id: tDoc.id, ...tDoc.data() });
        }
    }
    return timetables;
};

export const createPrivateTimetable = async (user, timetableData) => {
    const newTimetable = {
        ...timetableData,
        code: null, 
        isPrivate: true,
        creatorUid: user.uid,
        creatorName: user.displayName || user.email.split('@')[0],
        createdAt: Timestamp.now(),
        attendees: [user.uid] 
    };

    const docRef = await addDoc(collection(db, "public_timetables"), newTimetable);

    const joinRef = doc(db, "users", user.uid, "joined_timetables", docRef.id);
    await setDoc(joinRef, {
        timetableId: docRef.id,
        code: null,
        name: timetableData.name,
        joinedAt: Timestamp.now()
    });

    // Set semesterStartDate to today on create
    const todayStr = new Date().toISOString().slice(0, 10);
    await setDoc(doc(db, "users", user.uid), { semesterStartDate: todayStr }, { merge: true });

    return { id: docRef.id };
};

export const getUserCreatedTimetables = async (uid) => {
    const q = query(
        collection(db, "public_timetables"),
        where("creatorUid", "==", uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateTimetable = async (timetableId, timetableData, updaterUid) => {
    const timetableRef = doc(db, "public_timetables", timetableId);

    await updateDoc(timetableRef, {
        name: timetableData.name,
        schedule: timetableData.schedule,
        updatedAt: Timestamp.now()
    });

    if (updaterUid) {
        // Set semesterStartDate to today on edit
        const todayStr = new Date().toISOString().slice(0, 10);
        await setDoc(doc(db, "users", updaterUid), { semesterStartDate: todayStr }, { merge: true });
    }

    return { id: timetableId };
};

