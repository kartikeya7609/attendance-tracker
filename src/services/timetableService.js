
import { db } from "./firebase";
import { collection, addDoc, updateDoc, arrayUnion, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

// Helper to generate a 6-character random code
const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Create a new public timetable
export const createTimetable = async (user, timetableData) => {
    let unique = false;
    let code = "";

    // Ensure uniqueness
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
        attendees: [user.uid] // Creator auto-joins
    };

    const docRef = await addDoc(collection(db, "public_timetables"), newTimetable);

    // Add to user's joined list
    await joinTimetable(user.uid, code);

    return { id: docRef.id, code };
};

// Join a timetable by code
export const joinTimetable = async (uid, code) => {
    // 1. Find the timetable
    const q = query(collection(db, "public_timetables"), where("code", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error("Timetable not found");

    const timetableDoc = snapshot.docs[0];
    const timetableId = timetableDoc.id;
    const timetableData = timetableDoc.data();

    // 2. Check if already joined
    const joinRef = doc(db, "users", uid, "joined_timetables", timetableId);
    const joinSnap = await getDoc(joinRef);

    if (!joinSnap.exists() || (joinSnap.exists() && joinSnap.data().deleted)) {
        await setDoc(joinRef, {
            timetableId: timetableId,
            code: code,
            name: timetableData.name,
            joinedAt: Timestamp.now()
        });

        // Update valid attendee count on timetable
        await updateDoc(doc(db, "public_timetables", timetableId), {
            attendees: arrayUnion(uid)
        });

        // 3. Extract subjects from timetable schedule and add to user's subjects
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

        // Add subjects to user's subjects collection if not already present
        for (const subjectName of subjectsToAdd) {
            // Check if subject already exists
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
                    fromTimetable: timetableId // Track which timetable added this
                });
            }
        }
    }

    return timetableData;
};

// Leave a timetable
export const leaveTimetable = async (uid, timetableId) => {
    // 1. Remove from user's joined_timetables
    const joinRef = doc(db, "users", uid, "joined_timetables", timetableId);
    const joinSnap = await getDoc(joinRef);

    if (joinSnap.exists()) {
        await setDoc(joinRef, {}); // Clear the document
        await updateDoc(joinRef, { deleted: true }); // Mark as deleted

        // Alternative: Actually delete the document
        // await deleteDoc(joinRef);

        // 2. Remove from timetable's attendees list
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

// Get all public timetables
export const getAllTimetables = async () => {
    const q = query(collection(db, "public_timetables"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get user's joined timetables
export const getUserTimetables = async (uid) => {
    const q = query(collection(db, "users", uid, "joined_timetables"));
    const snapshot = await getDocs(q);
    const joined = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(j => !j.deleted); // Filter out deleted/left timetables

    // Fetch full details
    const timetables = [];
    for (const j of joined) {
        const tDoc = await getDoc(doc(db, "public_timetables", j.timetableId));
        if (tDoc.exists()) {
            timetables.push({ id: tDoc.id, ...tDoc.data() });
        }
    }
    return timetables;
};

// Create a PRIVATE timetable (not published, only for creator)
export const createPrivateTimetable = async (user, timetableData) => {
    const newTimetable = {
        ...timetableData,
        code: null, // No code for private timetables
        isPrivate: true,
        creatorUid: user.uid,
        creatorName: user.displayName || user.email.split('@')[0],
        createdAt: Timestamp.now(),
        attendees: [user.uid] // Only creator
    };

    const docRef = await addDoc(collection(db, "public_timetables"), newTimetable);

    // Add to user's joined list
    const joinRef = doc(db, "users", user.uid, "joined_timetables", docRef.id);
    await setDoc(joinRef, {
        timetableId: docRef.id,
        code: null,
        name: timetableData.name,
        joinedAt: Timestamp.now()
    });

    return { id: docRef.id };
};

// Get timetables CREATED by user (both public and private)
export const getUserCreatedTimetables = async (uid) => {
    const q = query(
        collection(db, "public_timetables"),
        where("creatorUid", "==", uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Update/Edit an existing timetable
export const updateTimetable = async (timetableId, timetableData) => {
    const timetableRef = doc(db, "public_timetables", timetableId);

    await updateDoc(timetableRef, {
        name: timetableData.name,
        schedule: timetableData.schedule,
        updatedAt: Timestamp.now()
    });

    return { id: timetableId };
};

