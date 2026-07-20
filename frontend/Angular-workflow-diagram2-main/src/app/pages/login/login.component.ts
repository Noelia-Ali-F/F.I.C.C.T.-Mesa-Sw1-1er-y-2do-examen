import { Component, inject, signal } from '@angular/core';
import { form, FormField, submit, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormField, MatIconModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  loginModel = signal({
    username: '',
    password: ''
  });

  loginForm = form(this.loginModel, (s) => {
    required(s.username);
    required(s.password);
  });

  isSubmitting = false;
  errorMsg = '';

  onSubmit() {
    submit(this.loginForm, async () => {
      this.isSubmitting = true;
      this.errorMsg = '';

      const credentials = {
        username: (this.loginModel().username || '').trim(),
        password: (this.loginModel().password || '').trim()
      };

      this.authService.login(credentials).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.isSubmitting = false;
          let errorMessage = 'Error desconocido';
          
          if (err.error && err.error.mensaje) {
            errorMessage = err.error.mensaje;
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          this.errorMsg = `SYS_ERROR: ${errorMessage}`;
          console.error('Login Payload/Error:', err);
        }
      });
    });
  }
}
