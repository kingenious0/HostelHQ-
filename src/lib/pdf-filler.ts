import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Hostel, RoomType } from '@/lib/data';

type BookingData = {
    id: string;
    studentId: string;
    studentDetails: {
        fullName: string;
        indexNumber?: string;
        phoneNumber?: string;
        email: string;
        program?: string;
        ghanaCard?: string;
        address?: string;
    };
    hostelId: string;
    bookingDate: string;
    status: string;
    roomTypeId?: string;
    paymentDeadline?: { seconds: number; nanoseconds: number; };
};

type ManagerData = {
    id: string;
    fullName: string;
};

/**
 * Fills the tenancy agreement PDF template with booking data
 * 
 * NOTE: This function works best if the PDF has AcroForm fields.
 * If the PDF only has text placeholders ({{PLACEHOLDER}}), those will need to be
 * converted to form fields in the PDF, or we'll need to implement text overlay
 * functionality which requires knowing exact text positions.
 * 
 * For now, this function:
 * 1. Attempts to fill form fields if they exist
 * 2. Returns the PDF (which may still have placeholders if no form fields exist)
 * 
 * To ensure auto-fill works, the PDF template should have form fields with names
 * matching the placeholder names (e.g., a field named "TENANT_NAME" for {{TENANT_NAME}})
 */
export async function fillTenancyAgreementPDF(
    booking: BookingData,
    hostel: Hostel,
    manager: ManagerData
): Promise<Uint8Array> {
    try {
        // Fetch the PDF template from the public folder
        const templateUrl = '/tenancy-agreement-template.pdf';
        const templateResponse = await fetch(templateUrl);
        const templateBytes = await templateResponse.arrayBuffer();
        
        // Load the PDF document
        const pdfDoc = await PDFDocument.load(templateBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        // Get the room type information
        const roomTypes = Array.isArray(hostel.roomTypes) ? hostel.roomTypes : [];
        const room = roomTypes.find(rt => rt.id === booking.roomTypeId) || roomTypes[0] || null;
        
        // Calculate dates
        const today = new Date();
        const academicYearStart = today.getFullYear();
        const academicYearEnd = today.getFullYear() + 1;
        
        // Prepare replacement data
        const replacements: Record<string, string> = {
            '{{CURRENT_DATE}}': today.toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }),
            '{{currentDate}}': today.toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }),
            '{{HOSTEL_NAME}}': hostel.name.toUpperCase(),
            '{{hostelName}}': hostel.name.toUpperCase(),
            '{{HOSTEL_LOCATION}}': hostel.location,
            '{{hostelLocation}}': hostel.location,
            '{{LANDLORD_NAME}}': manager.fullName,
            '{{landlordName}}': manager.fullName,
            '{{TENANT_NAME}}': booking.studentDetails.fullName,
            '{{tenantName}}': booking.studentDetails.fullName,
            '{{TENANT_INDEX_NUMBER}}': booking.studentDetails.indexNumber || 'N/A',
            '{{tenantIndexNumber}}': booking.studentDetails.indexNumber || 'N/A',
            '{{TENANT_EMAIL}}': booking.studentDetails.email,
            '{{tenantEmail}}': booking.studentDetails.email,
            '{{TENANT_MOBILE}}': booking.studentDetails.phoneNumber || 'N/A',
            '{{tenantMobile}}': booking.studentDetails.phoneNumber || 'N/A',
            '{{TENANT_PROGRAM}}': booking.studentDetails.program || 'N/A',
            '{{tenantProgram}}': booking.studentDetails.program || 'N/A',
            '{{GHANA_CARD}}': booking.studentDetails.ghanaCard || 'N/A',
            '{{ghanaCard}}': booking.studentDetails.ghanaCard || 'N/A',
            '{{TENANT_ADDRESS}}': booking.studentDetails.address || 'N/A',
            '{{tenantAddress}}': booking.studentDetails.address || 'N/A',
            '{{ROOM_TYPE}}': room?.name || 'N/A',
            '{{roomType}}': room?.name || 'N/A',
            '{{ROOM_PRICE}}': room && typeof room.price === 'number' ? room.price.toLocaleString() : 'N/A',
            '{{roomPrice}}': room && typeof room.price === 'number' ? room.price.toLocaleString() : 'N/A',
            '{{ACADEMIC_YEAR}}': `${academicYearStart}/${academicYearEnd}`,
            '{{academicYear}}': `${academicYearStart}/${academicYearEnd}`,
            '{{PAYMENT_DEADLINE}}': booking.paymentDeadline 
                ? new Date(booking.paymentDeadline.seconds * 1000).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'N/A',
            '{{paymentDeadline}}': booking.paymentDeadline 
                ? new Date(booking.paymentDeadline.seconds * 1000).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'N/A',
            '{{ROOM_SHARING_CLAUSE}}': hostel.roomSharingClause || 'Standard room sharing conditions apply.',
            '{{roomSharingClause}}': hostel.roomSharingClause || 'Standard room sharing conditions apply.',
            '{{ACCESS_RULES}}': hostel.accessRules || 'Standard access rules apply.',
            '{{accessRules}}': hostel.accessRules || 'Standard access rules apply.',
            '{{BOOKING_DATE}}': new Date(booking.bookingDate).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }),
            '{{bookingDate}}': new Date(booking.bookingDate).toLocaleDateString('en-GH', { year: 'numeric', month: 'long', day: 'numeric' }),
        };
        
        // Get form fields if the PDF has them
        const form = pdfDoc.getForm();
        const formFields = form.getFields();
        
        // Try to fill form fields first
        if (formFields.length > 0) {
            for (const field of formFields) {
                const fieldName = field.getName();
                // Try to find matching replacement
                for (const [placeholder, value] of Object.entries(replacements)) {
                    const cleanPlaceholder = placeholder.replace(/[{}]/g, '').toUpperCase();
                    const cleanFieldName = fieldName.toUpperCase();
                    if (cleanFieldName.includes(cleanPlaceholder) || cleanPlaceholder.includes(cleanFieldName)) {
                        try {
                            if (field.constructor.name === 'PDFTextField') {
                                (field as any).setText(value);
                            } else if (field.constructor.name === 'PDFDropdown') {
                                (field as any).select(value);
                            }
                        } catch (e) {
                            console.warn(`Could not fill field ${fieldName}:`, e);
                        }
                    }
                }
            }
        }
        
        // If no form fields, we'll need to overlay text
        // This is a fallback - for proper text replacement, the PDF should have form fields
        // or we need to know exact coordinates
        
        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
        
    } catch (error) {
        console.error('Error filling PDF:', error);
        throw new Error('Failed to fill PDF template: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Downloads a filled PDF
 */
export function downloadPDF(pdfBytes: Uint8Array, filename: string) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

