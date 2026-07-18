package com.smartwealth.resource;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

@QuarkusTest
class SessionResourceTest {

    @Test
    void testCreateSession() {
        given()
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .body("id", notNullValue())
            .body("isDemoActive", is(false))
            .body("createdAt", notNullValue())
            .body("lastAccessedAt", notNullValue());
    }

    @Test
    void testGetSession() {
        // Create a session first
        String sessionId = given()
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .extract().path("id");

        // Retrieve the session
        given()
            .header("X-Session-Id", sessionId)
            .when().get("/api/sessions/" + sessionId)
            .then()
            .statusCode(200)
            .body("id", is(sessionId))
            .body("isDemoActive", is(false));
    }

    @Test
    void testGetSessionNotFound() {
        UUID randomId = UUID.randomUUID();
        given()
            .header("X-Session-Id", randomId.toString())
            .when().get("/api/sessions/" + randomId)
            .then()
            .statusCode(404)
            .body("message", is("Session not found"));
    }

    @Test
    void testActivateDemo() {
        // Create a session
        String sessionId = given()
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .extract().path("id");

        // Activate demo
        given()
            .header("X-Session-Id", sessionId)
            .when().post("/api/sessions/" + sessionId + "/demo")
            .then()
            .statusCode(200)
            .body("isDemoActive", is(true));
    }

    @Test
    void testDeactivateDemo() {
        // Create a session
        String sessionId = given()
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .extract().path("id");

        // Activate demo first
        given()
            .header("X-Session-Id", sessionId)
            .when().post("/api/sessions/" + sessionId + "/demo")
            .then()
            .statusCode(200);

        // Deactivate demo
        given()
            .header("X-Session-Id", sessionId)
            .when().delete("/api/sessions/" + sessionId + "/demo")
            .then()
            .statusCode(200)
            .body("isDemoActive", is(false));
    }

    @Test
    void testMissingSessionHeader() {
        String sessionId = given()
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .extract().path("id");

        // GET without X-Session-Id header should fail
        given()
            .when().get("/api/sessions/" + sessionId)
            .then()
            .statusCode(400)
            .body("message", is("X-Session-Id header is required"));
    }

    @Test
    void testInvalidSessionHeader() {
        String sessionId = given()
            .when().post("/api/sessions")
            .then()
            .statusCode(201)
            .extract().path("id");

        // GET with invalid UUID should fail
        given()
            .header("X-Session-Id", "not-a-valid-uuid")
            .when().get("/api/sessions/" + sessionId)
            .then()
            .statusCode(400)
            .body("message", is("X-Session-Id header must be a valid UUID"));
    }
}
