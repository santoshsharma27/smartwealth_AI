package com.smartwealth.resource;

import jakarta.ws.rs.FormParam;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.PartType;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.List;

/**
 * Multipart form input class for document upload.
 * Quarkus RESTEasy Reactive requires this approach for complex multipart forms.
 */
public class DocumentUploadForm {

    @RestForm("files")
    public List<FileUpload> files;

    @RestForm("documentTypes")
    public List<String> documentTypes;
}
