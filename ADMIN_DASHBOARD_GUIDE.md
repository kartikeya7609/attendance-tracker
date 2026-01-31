# Admin Dashboard - Complete Guide

## Overview
The Admin Dashboard is accessible only to the creator (email: `24U123@gmail.com`) and provides complete control over all attendance records and timetables.

## Features

### 📊 **Two Tabs System**

#### 1. **Attendance Responses Tab**
View and manage all student attendance records.

**Features:**
- ✅ View all attendance records from all students
- ✅ Filter by date
- ✅ Search by student email or subject
- ✅ View student full details (subjects, timetable, activity log)
- ✅ **Delete fake/spam attendance records**
- ✅ Export filtered data to CSV

**Actions:**
- **View Button** - See complete student profile with:
  - Enrolled subjects
  - Weekly timetable
  - Recent activity log (last 20 entries)
  
- **Delete Button (🗑️)** - Remove fake attendance records
  - Shows confirmation modal
  - Displays record details before deletion
  - Cannot be undone!

#### 2. **Timetables Tab**
Manage all public timetables in the system.

**Features:**
- ✅ View all created timetables
- ✅ See timetable code, creator, subjects, and member count
- ✅ Search by timetable name, code, or creator
- ✅ **Delete fake/spam timetables**
- ✅ Export timetables data to CSV

**Each Timetable Card Shows:**
- Timetable code (for joining)
- Name and creator
- Top 3 subjects
- Number of scheduled days
- Member count
- Delete button (🗑️)

**Delete Action:**
- Click the delete button on any timetable card
- Confirms deletion with a warning modal
- Permanently removes the timetable from the database
- Members will no longer see this timetable

## How to Use

### **Access Admin Dashboard:**
1. Login with admin email: `24U123@gmail.com`
2. Click "**Admin**" in the navigation bar (visible only to admin)
3. Choose between "Attendance Responses" or "Timetables" tab

### **Delete Fake Attendance Records:**
1. Go to "**Attendance Responses**" tab
2. Use search/filter to find suspicious records
3. Click the **trash icon (🗑️)** next to the record
4. Confirm deletion in the modal
5. Record is permanently deleted

### **Delete Fake Timetables:**
1. Go to "**Timetables**" tab
2. Browse all timetables or search for specific ones
3. Click the **trash icon (🗑️)** on the timetable card
4. Confirm deletion in the modal
5. Timetable is permanently deleted

### **Export Data:**
1. Use filters/search to narrow down data
2. Click "**Export CSV**" button (top right)
3. Downloads filtered data:
   - Responses tab → attendance_export.csv
   - Timetables tab → timetables_export.csv

### **View Student Details:**
1. In "Attendance Responses" tab
2. Click "**View**" button for any student
3. Modal shows:
   - All enrolled subjects
   - Complete weekly timetable
   - Recent attendance activity

## Data Management Best Practices

### **When to Delete Attendance Records:**
- ❌ Duplicate entries
- ❌ Test/spam records
- ❌ Records with invalid data
- ❌ Entries from deleted users

### **When to Delete Timetables:**
- ❌ Test timetables
- ❌ Duplicate timetables
- ❌ Timetables with no members
- ❌ Spam/fake timetables
- ❌ Outdated semester timetables

### **⚠️ Important Warnings:**

**Deleting Attendance Records:**
- Permanently removes the record
- Cannot be recovered
- Student's attendance percentage will be recalculated
- Does NOT delete the subject or student account

**Deleting Timetables:**
- Permanently removes the timetable
- All members lose access to this timetable
- Members' joined_timetables list is NOT automatically updated
- Subjects created from this timetable remain in student accounts
- Cannot be undone!

## Security
- Only accessible to `24U123@gmail.com`
- Protected by `AdminRoute` component
- All delete actions require confirmation
- Deletes are logged in browser console

## CSV Export Fields

**Attendance Export:**
- Date
- Student Email
- Subject
- Status (Present/Absent/Late)
- Time Marked

**Timetables Export:**
- Timetable Name
- Code
- Creator
- Member Count
- Created Date

## Troubleshooting

**Issue: Can't see Admin link**
- **Solution:** Login with `24U123@gmail.com`

**Issue: Delete button not working**
- **Solution:** Check browser console for errors, refresh page

**Issue: Deleted timetable still shows for users**
- **Solution:** Users need to refresh their page to see changes

**Issue: Can't export CSV**
- **Solution:** Make sure you have records in current tab and browser allows downloads

## Future Enhancements
- Bulk delete functionality
- Admin activity log
- Restore deleted items (trash bin)
- Email notifications for admin actions
- Advanced filtering and sorting
