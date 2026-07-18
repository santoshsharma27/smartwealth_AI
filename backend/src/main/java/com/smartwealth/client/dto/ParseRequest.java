package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request DTO for document parsing endpoint POST /ai/parse.
 */
public class ParseRequest {

    @JsonProperty("documentId")
    public String documentId;

    @JsonProperty("documentType")
    public String documentType;

    @JsonProperty("fileFormat")
    public String fileFormat;

    @JsonProperty("fileContent")
    public String fileContent;

    public ParseRequest() {
    }

    public ParseRequest(String documentId, String documentType, String fileFormat, String fileContent) {
        this.documentId = documentId;
        this.documentType = documentType;
        this.fileFormat = fileFormat;
        this.fileContent = fileContent;
    }
}
