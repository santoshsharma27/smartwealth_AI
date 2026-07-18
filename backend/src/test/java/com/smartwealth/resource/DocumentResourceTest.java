package com.smartwealth.resource;

import com.smartwealth.entity.Session;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for DocumentResource.
 * Tests document upload validation and retrieval endpoints.
 */
@QuarkusTest
public class DocumentResourceTest {

    @Inject
    EntityManager entityManager;

    private UUID sessionId;

    @BeforeEach
    @Transactional
    public void setUp() {
        // Create a session for testing
        Session session = new Session();
        session.persist();
        sessionId = session.id;
    }

    @Test
    public void testSuccessfulUpload() throws IOException {
        File pdfFile = createTempFile("test_salary.pdf", "PDF content for testing");

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", pdfFile, "application/pdf")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(202)
                .body("documents", hasSize(1))
                .body("documents[0].id", notNullValue())
                .body("documents[0].fileName", equalTo("test_salary.pdf"))
                .body("documents[0].documentType", equalTo("salary_slip"))
                .body("documents[0].status", equalTo("uploaded"));
    }

    @Test
    public void testSuccessfulMultipleFileUpload() throws IOException {
        File pdfFile = createTempFile("salary.pdf", "PDF content");
        File csvFile = createTempFile("statement.csv", "date,description,amount\n2024-01-01,Test,100");

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", pdfFile, "application/pdf")
                .multiPart("files", csvFile, "text/csv")
                .multiPart("documentTypes", "salary_slip")
                .multiPart("documentTypes", "bank_statement")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(202)
                .body("documents", hasSize(2));
    }

    @Test
    public void testRejectInvalidFormatForSalarySlip() throws IOException {
        // CSV is not valid for salary slips
        File csvFile = createTempFile("salary.csv", "some,csv,content");

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", csvFile, "text/csv")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(400)
                .body("error", containsString("Invalid format for salary slip"));
    }

    @Test
    public void testRejectInvalidFormatForBankStatement() throws IOException {
        // TXT is not valid for bank statements
        File txtFile = createTempFile("statement.txt", "some text content");

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", txtFile, "text/plain")
                .multiPart("documentTypes", "bank_statement")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(400)
                .body("error", containsString("Invalid format for bank statement"));
    }

    @Test
    public void testRejectOversizedFile() throws IOException {
        // Create a file slightly larger than 10MB (use a smaller size to avoid slow tests)
        // The validation checks file size via Files.size(file.filePath())
        File largeFile = createLargeFile("large.pdf", 10_485_761);

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", largeFile, "application/pdf")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(400)
                .body("error", containsString("exceeds the maximum allowed file size"));
    }

    @Test
    public void testRejectTooManyDocuments() throws IOException {
        // Try to upload 6 files (max is 5)
        File pdfFile1 = createTempFile("doc1.pdf", "content1");
        File pdfFile2 = createTempFile("doc2.pdf", "content2");
        File pdfFile3 = createTempFile("doc3.pdf", "content3");
        File pdfFile4 = createTempFile("doc4.pdf", "content4");
        File pdfFile5 = createTempFile("doc5.pdf", "content5");
        File pdfFile6 = createTempFile("doc6.pdf", "content6");

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", pdfFile1, "application/pdf")
                .multiPart("files", pdfFile2, "application/pdf")
                .multiPart("files", pdfFile3, "application/pdf")
                .multiPart("files", pdfFile4, "application/pdf")
                .multiPart("files", pdfFile5, "application/pdf")
                .multiPart("files", pdfFile6, "application/pdf")
                .multiPart("documentTypes", "salary_slip")
                .multiPart("documentTypes", "salary_slip")
                .multiPart("documentTypes", "salary_slip")
                .multiPart("documentTypes", "salary_slip")
                .multiPart("documentTypes", "salary_slip")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(400)
                .body("error", containsString("Document count must be between"));
    }

    @Test
    public void testListDocuments() throws IOException {
        // Upload a document first
        File pdfFile = createTempFile("salary.pdf", "PDF content");

        given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", pdfFile, "application/pdf")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(202);

        // List documents
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(200)
                .body("documents", hasSize(1))
                .body("documents[0].documentType", equalTo("salary_slip"));
    }

    @Test
    public void testGetDocumentStatus() throws IOException {
        // Upload a document first
        File pdfFile = createTempFile("salary.pdf", "PDF content");

        String docId = given()
                .header("X-Session-Id", sessionId.toString())
                .multiPart("files", pdfFile, "application/pdf")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + sessionId + "/documents")
                .then()
                .statusCode(202)
                .extract()
                .path("documents[0].id");

        // Get document status
        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/documents/" + docId + "/status")
                .then()
                .statusCode(200)
                .body("id", equalTo(docId))
                .body("status", equalTo("uploaded"));
    }

    @Test
    public void testSessionNotFound() throws IOException {
        UUID nonExistentSession = UUID.randomUUID();
        File pdfFile = createTempFile("salary.pdf", "PDF content");

        given()
                .header("X-Session-Id", nonExistentSession.toString())
                .multiPart("files", pdfFile, "application/pdf")
                .multiPart("documentTypes", "salary_slip")
                .when()
                .post("/api/sessions/" + nonExistentSession + "/documents")
                .then()
                .statusCode(404)
                .body("error", containsString("Session not found"));
    }

    @Test
    public void testDocumentNotFound() {
        UUID nonExistentDoc = UUID.randomUUID();

        given()
                .header("X-Session-Id", sessionId.toString())
                .when()
                .get("/api/sessions/" + sessionId + "/documents/" + nonExistentDoc + "/status")
                .then()
                .statusCode(404)
                .body("error", containsString("Document not found"));
    }

    private File createTempFile(String fileName, String content) throws IOException {
        Path tempDir = Files.createTempDirectory("smartwealth-test");
        Path filePath = tempDir.resolve(fileName);
        Files.writeString(filePath, content);
        File file = filePath.toFile();
        file.deleteOnExit();
        return file;
    }

    private File createLargeFile(String fileName, int sizeBytes) throws IOException {
        Path tempDir = Files.createTempDirectory("smartwealth-test");
        Path filePath = tempDir.resolve(fileName);
        byte[] content = new byte[sizeBytes];
        Files.write(filePath, content);
        File file = filePath.toFile();
        file.deleteOnExit();
        return file;
    }
}
