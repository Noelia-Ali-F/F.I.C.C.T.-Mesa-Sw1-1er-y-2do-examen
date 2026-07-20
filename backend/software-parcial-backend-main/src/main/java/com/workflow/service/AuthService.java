package com.workflow.service;

import com.workflow.dto.request.LoginRequest;
import com.workflow.dto.request.RegisterRequest;
import com.workflow.dto.response.AuthResponse;

public interface AuthService {
    
    AuthResponse login(LoginRequest request);
    
    AuthResponse register(RegisterRequest request);
}
