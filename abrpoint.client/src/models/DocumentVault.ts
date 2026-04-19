export interface DocumentVault {
    id: number;
    soccod: string;
    empcod: string;
    docName: string;
    docType: string;
    docPath: string;
    docSize: number;
    docDate: string;
    isSigned: boolean;
    signatureDate: string | null;
    signaturePath: string | null;
    status: string;
}
