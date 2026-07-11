// ============================================================
// المنطق المشترك بين المريض والإدارة وشاشة التلفاز - مبني على Firestore
// ============================================================
import {
    collection, doc, runTransaction, query, where, onSnapshot,
    updateDoc, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, CLINIC_ID } from "./firebase-config.js";

// ========== إعدادات ساعات الدوام والحجز ==========
export const CLINIC_START_HOUR = 8;
export const CLINIC_END_HOUR = 16;
export const SLOT_MINUTES = 15;
export const NEW_DAY_BOOKING_HOUR = 18;
export const MAX_DAILY_CAPACITY = Math.floor((CLINIC_END_HOUR - CLINIC_START_HOUR) * 60 / SLOT_MINUTES);

// ========== مسارات Firestore (مبنية على CLINIC_ID لدعم عدة عيادات لاحقاً) ==========
const appointmentsCol = collection(db, "clinics", CLINIC_ID, "appointments");
const countersCol = collection(db, "clinics", CLINIC_ID, "counters");

// ========== دوال التاريخ ==========
export function formatDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function todayKey() { return formatDateKey(new Date()); }
export function addDaysKey(dateKey, n) {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + n);
    return formatDateKey(d);
}

export function calculateEstimatedTime(role, outsideHoursLabel = "خارج الدوام") {
    const totalMinutes = (role - 1) * SLOT_MINUTES;
    const maxMinutes = (CLINIC_END_HOUR - CLINIC_START_HOUR) * 60;
    if (totalMinutes >= maxMinutes) return outsideHoursLabel;
    const hour = CLINIC_START_HOUR + Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function pickInitialBookingDate() {
    const now = new Date();
    let target = new Date(now);
    if (now.getHours() >= NEW_DAY_BOOKING_HOUR) {
        target.setDate(target.getDate() + 1);
    }
    return formatDateKey(target);
}

// ========== حجز مقعد جديد (Transaction ذرّية تمنع تعارض رقمين لمريضين بنفس اللحظة) ==========
export async function bookNewSlot({ name, phone }) {
    return await runTransaction(db, async (tx) => {
        let targetDate = pickInitialBookingDate();
        let role = null;

        for (let i = 0; i < 14; i++) { // حد أقصى أسبوعين تحسباً لأي ظرف استثنائي
            const counterRef = doc(countersCol, targetDate);
            const counterSnap = await tx.get(counterRef);
            const lastRole = counterSnap.exists() ? (counterSnap.data().lastRole || 0) : 0;
            const nextRole = lastRole + 1;

            if (nextRole > MAX_DAILY_CAPACITY) {
                targetDate = addDaysKey(targetDate, 1);
                continue;
            }

            tx.set(counterRef, { lastRole: nextRole }, { merge: true });
            role = nextRole;
            break;
        }

        if (role === null) {
            throw new Error("تعذر تخصيص دور، حاول لاحقاً");
        }

        const apptRef = doc(appointmentsCol);
        const newAppointment = {
            name, phone, role, date: targetDate,
            status: "waiting",
            time: calculateEstimatedTime(role),
            fcmToken: null,
            createdAt: serverTimestamp(),
            servedAt: null,
            completedAt: null
        };
        tx.set(apptRef, newAppointment);

        return { id: apptRef.id, ...newAppointment, date: targetDate, role };
    });
}

// ========== البحث عن حجز نشط بنفس رقم الهاتف (منع التكرار) ==========
export async function findActiveBookingByPhone(phone) {
    const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const q = query(
        appointmentsCol,
        where("phone", "==", phone),
        where("status", "in", ["waiting", "active"])
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
}

// ========== ربط جهاز المريض (Real-time) لمتابعة حجزه بتذكرته ==========
export function listenToAppointment(id, callback) {
    return onSnapshot(doc(appointmentsCol, id), (snap) => {
        if (!snap.exists()) { callback(null); return; }
        callback({ id: snap.id, ...snap.data() });
    });
}

// ========== ربط لوحة الإدارة / شاشة التلفاز بطابور يوم معين (Real-time) ==========
export function listenToQueue(date, callback) {
    const q = query(
        appointmentsCol,
        where("date", "==", date),
        where("status", "in", ["waiting", "active"])
    );
    return onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const active = list.find(a => a.status === "active") || null;
        const waiting = list.filter(a => a.status === "waiting").sort((a, b) => a.role - b.role);
        callback({ active, waiting });
    });
}

// ========== ربط لوحة الإدارة بكل حجوزات يوم معين (لإحصائيات مكتمل/غائب) ==========
export function listenToDayStats(date, callback) {
    const q = query(appointmentsCol, where("date", "==", date));
    return onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(list);
    });
}

// ========== إجراءات الإدارة ==========
export async function markActive(id, role) {
    await updateDoc(doc(appointmentsCol, id), { status: "active", servedAt: serverTimestamp() });
}
export async function markCompleted(id) {
    await updateDoc(doc(appointmentsCol, id), { status: "completed", completedAt: serverTimestamp() });
}
export async function markNoShow(id) {
    await updateDoc(doc(appointmentsCol, id), { status: "no-show", completedAt: serverTimestamp() });
}
export async function markCancelled(id) {
    await updateDoc(doc(appointmentsCol, id), { status: "cancelled" });
}
export async function renamePatient(id, newName) {
    await updateDoc(doc(appointmentsCol, id), { name: newName });
}
export async function removeAppointment(id) {
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    await deleteDoc(doc(appointmentsCol, id));
}
export async function delayToEndOfQueue(id, date) {
    return await runTransaction(db, async (tx) => {
        const counterRef = doc(countersCol, date);
        const counterSnap = await tx.get(counterRef);
        const lastRole = counterSnap.exists() ? (counterSnap.data().lastRole || 0) : 0;
        const newRole = lastRole + 1;
        tx.set(counterRef, { lastRole: newRole }, { merge: true });
        tx.update(doc(appointmentsCol, id), { role: newRole, time: calculateEstimatedTime(newRole) });
        return newRole;
    });
}

// ========== حفظ رمز الإشعار (FCM Token) الخاص بجهاز المريض على حجزه ==========
export async function attachFcmToken(id, token) {
    await updateDoc(doc(appointmentsCol, id), { fcmToken: token });
}

// ========== مراقبة عداد يوم معين (لمعرفة "دورك القادم لو سجلت الآن" و"الإجمالي") ==========
export function listenToCounter(date, callback) {
    const ref = doc(countersCol, date);
    return onSnapshot(ref, (snap) => {
        const lastRole = snap.exists() ? (snap.data().lastRole || 0) : 0;
        callback(lastRole);
    });
}

export function countPatientsAhead(patient, waitingList, activePatient) {
    const index = waitingList.findIndex(a => a.id === patient.id);
    let ahead = index >= 0 ? index : 0;
    if (activePatient && patient.status === "waiting") ahead += 1;
    return ahead;
}
