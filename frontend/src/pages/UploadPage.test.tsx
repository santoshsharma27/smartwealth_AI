import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from '../context/SessionContext';
import { UploadPage, validateFile } from './UploadPage';

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderUploadPage() {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/upload']}>
        <Routes>
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>
  );
}

function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('UploadPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('renders the page heading', () => {
      renderUploadPage();
      expect(
        screen.getByRole('heading', { level: 1, name: /Upload Documents/i })
      ).toBeInTheDocument();
    });

    it('renders the dropzone with instructions', () => {
      renderUploadPage();
      expect(
        screen.getByText(/Drag and drop files here/)
      ).toBeInTheDocument();
      expect(screen.getByText(/click to browse/)).toBeInTheDocument();
    });

    it('renders accepted file type information', () => {
      renderUploadPage();
      expect(
        screen.getByText(/PDF for salary slips, PDF or CSV for bank statements/)
      ).toBeInTheDocument();
    });

    it('renders the upload button', () => {
      renderUploadPage();
      expect(
        screen.getByRole('button', { name: /upload selected documents/i })
      ).toBeInTheDocument();
    });

    it('renders the dropzone with keyboard accessibility', () => {
      renderUploadPage();
      const dropzone = screen.getByRole('button', {
        name: /file upload dropzone/i,
      });
      expect(dropzone).toHaveAttribute('tabindex', '0');
    });
  });

  describe('File Addition', () => {
    it('adds files via the file input', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('salary.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      expect(screen.getByText('salary.pdf')).toBeInTheDocument();
    });

    it('shows document type selector per file', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('bank.pdf', 2048, 'application/pdf');
      await user.upload(fileInput, file);

      expect(
        screen.getByLabelText(/select document type for bank\.pdf/i)
      ).toBeInTheDocument();
    });

    it('shows file size', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('doc.pdf', 5 * 1024 * 1024, 'application/pdf');
      await user.upload(fileInput, file);

      expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    });

    it('shows file counter', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      expect(screen.getByText('0/5 files added')).toBeInTheDocument();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('file.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      expect(screen.getByText('1/5 files added')).toBeInTheDocument();
    });
  });

  describe('File Removal', () => {
    it('allows removing individual files', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('remove-me.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      expect(screen.getByText('remove-me.pdf')).toBeInTheDocument();

      const removeBtn = screen.getByLabelText(/remove remove-me\.pdf/i);
      await user.click(removeBtn);

      expect(screen.queryByText('remove-me.pdf')).not.toBeInTheDocument();
    });
  });

  describe('File Count Validation', () => {
    it('rejects more than 5 files (only adds up to max)', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const files = Array.from({ length: 6 }, (_, i) =>
        createMockFile(`file${i + 1}.pdf`, 1024, 'application/pdf')
      );

      await user.upload(fileInput, files);

      // Only 5 should be added
      expect(screen.getByText('5/5 files added')).toBeInTheDocument();
      expect(screen.queryByText('file6.pdf')).not.toBeInTheDocument();
    });
  });

  describe('Format Validation', () => {
    it('shows error for non-PDF salary slip', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('data.csv', 1024, 'text/csv');
      await user.upload(fileInput, file);

      // Select salary slip type
      const select = screen.getByLabelText(/select document type for data\.csv/i);
      await user.selectOptions(select, 'salary_slip');

      expect(
        screen.getByText(/file format not supported\. please upload PDF for salary slips/i)
      ).toBeInTheDocument();
    });

    it('shows error for non-PDF/CSV bank statement', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      // Use fireEvent.drop to bypass the file input accept filter
      // This simulates drag-and-drop where any file type can be dropped
      const dropzone = screen.getByRole('button', {
        name: /file upload dropzone/i,
      });
      const file = createMockFile('image.png', 1024, 'image/png');
      const dataTransfer = {
        files: [file],
        types: ['Files'],
      };

      fireEvent.dragOver(dropzone, { dataTransfer });
      fireEvent.drop(dropzone, { dataTransfer });

      // Select bank statement type
      const select = screen.getByLabelText(/select document type for image\.png/i);
      await user.selectOptions(select, 'bank_statement');

      expect(
        screen.getByText(/file format not supported\. please upload PDF or CSV for bank statements/i)
      ).toBeInTheDocument();
    });

    it('accepts PDF for salary slip without error', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('salary.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      const select = screen.getByLabelText(/select document type for salary\.pdf/i);
      await user.selectOptions(select, 'salary_slip');

      expect(
        screen.queryByText(/file format not supported/i)
      ).not.toBeInTheDocument();
    });

    it('accepts CSV for bank statement without error', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('statement.csv', 1024, 'text/csv');
      await user.upload(fileInput, file);

      const select = screen.getByLabelText(/select document type for statement\.csv/i);
      await user.selectOptions(select, 'bank_statement');

      expect(
        screen.queryByText(/file format not supported/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Size Validation', () => {
    it('shows error for file exceeding 10 MB', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const bigFile = createMockFile('large.pdf', 11 * 1024 * 1024, 'application/pdf');
      await user.upload(fileInput, bigFile);

      // Select type to trigger validation
      const select = screen.getByLabelText(/select document type for large\.pdf/i);
      await user.selectOptions(select, 'salary_slip');

      expect(
        screen.getByText(/file exceeds maximum size of 10 MB/i)
      ).toBeInTheDocument();
    });

    it('shows error for empty (zero-byte) file', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      await user.upload(fileInput, emptyFile);

      const select = screen.getByLabelText(/select document type for empty\.pdf/i);
      await user.selectOptions(select, 'salary_slip');

      expect(
        screen.getByText(/file is empty/i)
      ).toBeInTheDocument();
    });
  });

  describe('Upload Button State', () => {
    it('upload button is disabled when no files are selected', () => {
      renderUploadPage();
      const uploadBtn = screen.getByRole('button', {
        name: /upload selected documents/i,
      });
      expect(uploadBtn).toBeDisabled();
    });

    it('upload button is disabled when document type is not selected', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('test.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      const uploadBtn = screen.getByRole('button', {
        name: /upload selected documents/i,
      });
      expect(uploadBtn).toBeDisabled();
    });

    it('upload button is enabled when valid file with document type is selected', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('salary.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      const select = screen.getByLabelText(/select document type for salary\.pdf/i);
      await user.selectOptions(select, 'salary_slip');

      const uploadBtn = screen.getByRole('button', {
        name: /upload selected documents/i,
      });
      expect(uploadBtn).toBeEnabled();
    });

    it('upload button is disabled when file has validation error', async () => {
      const user = userEvent.setup();
      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('data.csv', 1024, 'text/csv');
      await user.upload(fileInput, file);

      const select = screen.getByLabelText(/select document type for data\.csv/i);
      await user.selectOptions(select, 'salary_slip');

      const uploadBtn = screen.getByRole('button', {
        name: /upload selected documents/i,
      });
      expect(uploadBtn).toBeDisabled();
    });
  });

  describe('Upload Flow', () => {
    it('shows uploading state and navigates to dashboard on success', async () => {
      const user = userEvent.setup();

      // Mock fetch for session creation and document upload
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        if (urlStr.includes('/sessions') && !urlStr.includes('/documents')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ id: 'test-session-upload', isDemoActive: false }),
            text: async () => JSON.stringify({ id: 'test-session-upload', isDemoActive: false }),
          };
        }
        if (urlStr.includes('/documents')) {
          return {
            ok: true,
            status: 202,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ documents: [{ id: 'doc-1', fileName: 'salary.pdf', documentType: 'salary_slip', status: 'processing', uploadedAt: '2024-01-15T10:30:00Z' }] }),
            text: async () => '{}',
          };
        }
        return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' };
      }) as unknown as typeof fetch;

      renderUploadPage();

      const fileInput = screen.getByLabelText(/select files to upload/i);
      const file = createMockFile('salary.pdf', 1024, 'application/pdf');
      await user.upload(fileInput, file);

      const select = screen.getByLabelText(/select document type for salary\.pdf/i);
      await user.selectOptions(select, 'salary_slip');

      const uploadBtn = screen.getByRole('button', {
        name: /upload selected documents/i,
      });
      await user.click(uploadBtn);

      // Shows success message
      await waitFor(() => {
        expect(
          screen.getByText(/documents uploaded successfully/i)
        ).toBeInTheDocument();
      });

      // Navigates to dashboard
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
        },
        { timeout: 3000 }
      );
    });
  });
});

describe('validateFile', () => {
  it('returns undefined for valid PDF salary slip', () => {
    const file = createMockFile('salary.pdf', 1024, 'application/pdf');
    expect(validateFile(file, 'salary_slip')).toBeUndefined();
  });

  it('returns undefined for valid CSV bank statement', () => {
    const file = createMockFile('statement.csv', 1024, 'text/csv');
    expect(validateFile(file, 'bank_statement')).toBeUndefined();
  });

  it('returns error for oversized file', () => {
    const file = createMockFile('big.pdf', 11 * 1024 * 1024, 'application/pdf');
    expect(validateFile(file, 'salary_slip')).toContain('10 MB');
  });

  it('returns error for empty file', () => {
    const file = new File([], 'empty.pdf', { type: 'application/pdf' });
    expect(validateFile(file, 'salary_slip')).toContain('empty');
  });

  it('returns error for CSV as salary slip', () => {
    const file = createMockFile('data.csv', 1024, 'text/csv');
    expect(validateFile(file, 'salary_slip')).toContain('PDF for salary slips');
  });

  it('returns error for PNG as bank statement', () => {
    const file = createMockFile('pic.png', 1024, 'image/png');
    expect(validateFile(file, 'bank_statement')).toContain('PDF or CSV');
  });

  it('returns undefined when no document type selected (no format check)', () => {
    const file = createMockFile('anything.txt', 1024, 'text/plain');
    expect(validateFile(file, '')).toBeUndefined();
  });
});
